import sys
import json
import jwt
import time
from functools import wraps
from flask import g, current_app, request, Blueprint, after_this_request, \
    Response
from flask_restful import abort, Resource, Api
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from rest_backend.db import get_db

# Helper methods for authentication through app.
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if g.user is None:
            abort(401)
        return f(*args, **kwargs)
    return decorated_function

def get_user_id():
    return g.user

def check_authenticated():
    g.user = None
    try:
        auth_data = validate_wart_token(request.cookies.get('jwt_token').encode('ascii'))
        g.user = auth_data['user']
        return True
    except:
        return False

def validate_wart_token(jwt_token):
    # TODO: Have it actually decode the auth header somehow, such as JWT.
    try:
        decoded_jwt = jwt.decode(
            jwt_token,
            current_app.config['JWT_SECRET'],
            algorithm='HS256',
        )
        return {'user': decoded_jwt['user']}
    except:
        return {}

def validate_simple_auth_token(token):
    """'Decodes' a token which is just the username. This is purely so I can
    test locally in an easy way. It should *never* be used in production."""
    if type(token) == str:
        return {
            'username': token,
            'authid': token,
        }
    else:
        return {}

def validate_google_auth_token(token):
    # Use google-auth API to decode and verify the token.
    decoded = google_id_token.verify_oauth2_token(
        token['tokenId'],
        google_requests.Request(),
        current_app.config['GOOGLE_AUTH_CLIENT'],
    )

    # Make sure it's actually from Google.
    if decoded['iss'] not in \
            ['accounts.google.com', 'https://accounts.google.com']:
        return {}

    # Return only the data we're interested in
    # (email address and unique Google ID).
    return {
        'username': decoded['email'],
        'authid': decoded['sub'],
    }

def encode_wart_token(mongo_data):
    """Creates the token which will be passed to us for all future requests
    from the frontend. Also enters the token in the DB."""
    # TODO: Maybe some other security.
    # TODO: Actually create session in Mongo.
    expiry_date = time.time() + current_app.config['MAX_COOKIE_AGE']
    encoded_jwt = jwt.encode(
        {
            'user': mongo_data['authid'],
        },
        current_app.config['JWT_SECRET'],
        algorithm='HS256',
    )
    return expiry_date, encoded_jwt

def create_session(expiry_date, encoded_jwt, user_id):
    """Creates the session in mongo."""
    db = get_db()
    db.get_collection('sessions').update_one(
        {'user_id': user_id, 'expiry_date': expiry_date},
        {'$set': {
            'user_id': user_id,
            'expiry_date': expiry_date,
            'encoded_jwt': encoded_jwt,
        }},
        upsert=True
    )

def validate_session(encoded_jwt, user_id):
    user_session = db.get_collection('sessions').find_one(
        {'user_id': user_id, 'encoded_jwt': encoded_jwt}
    )
    if user_session == None:
        return False
    if user_session['expiry_date'] < time.time():
        return False
    return True


# Now for the actual authentication endpoints.
class Authentication(Resource):
    def get(self):
        """GET /api/v1/auth
        Checks a provided Authorization header and replies with the
        decoded auth header if it is valid. Empty response otherwise."""
        auth_data = validate_wart_token(request.cookies.get('jwt_token'))
        if 'user' in auth_data:
            return auth_data
        else:
            abort(401)

    def post(self):
        """POST /api/v1/auth
        Receives a 3rd-party auth token as JSON data and replies with
        a WaRT auth token if it is valid. Empty response otherwise."""
        args = request.get_json(force=True)
        db = get_db()

        # Allow simple auth in dev mode.
        if current_app.config['ENV'] == 'development' \
                and type(args['token']) == str:
            auth_method = 'simple'
            decoded_token = validate_simple_auth_token(args['token'])
        # In all other environments, require Google Auth.
        else:
            auth_method = 'google'
            decoded_token = validate_google_auth_token(args['token'])

        # If the token is not valid, return 401.
        if 'authid' not in decoded_token:
            abort(401)

        # We have an ID. Make sure there is a row in the DB with upsert.
        # We don't care if the user has "registered" previously, because our
        # authentication is already handled by a 3rd-party which prevents bots.
        db.get_collection('users').update_one(
            {'authid': decoded_token['authid']},
            {'$set': {
                'authid': decoded_token['authid'],
                'auth_method': auth_method,
            }},
            upsert=True)
        # Now that the user is guaranteed existing, find their document.
        user_mongo = db.get_collection('users').find_one(
            {'authid': decoded_token['authid']})

        # We have a valid token for a valid user. Create a session for them.
        expiry_date, new_token = encode_wart_token(user_mongo)
        create_session(expiry_date, new_token, decoded_token['authid'])

        # Set the HTTP-only cookie for authentication
        resp = Response(
            json.dumps({
                    'expiry_date': expiry_date,
                    'username': decoded_token['username'],
                    'auth_method': auth_method,
            }),
            201,
            content_type='application/json'
        )
        resp.set_cookie(
            'jwt_token',
            new_token,
            expires=expiry_date,
            secure=current_app.config['JWT_SECURE'],
            httponly=True,
        )
        return resp


# And the logout endpoint.
class Logout(Resource):
    def post(self):
        # TODO: Actually delete session in Mongo.
        return {}

# Check the auth header before every request.
bp = Blueprint('auth', __name__)
@bp.before_app_request
def load_auth_user():
    check_authenticated()

api = Api(bp)
api.add_resource(Authentication, '/api/v1/auth')
api.add_resource(Logout, '/api/v1/logout')
