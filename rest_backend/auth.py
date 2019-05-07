import sys
import json
from functools import wraps
from flask import g, request, Blueprint
from flask_restful import abort, Resource, Api

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
    auth_data = decode_auth_header(request.headers.get('Authorization'))
    if valid_wart_token(auth_data):
        g.user = auth_data['user']
        return True
    return False

def decode_auth_header(auth_header):
    # TODO: Have it actually decode the auth header somehow, such as JWT.
    try:
        auth_header = json.loads(auth_header)
        if 'user' in auth_header:
            return {'username': auth_header['username'],
                    'user': auth_header['user']}
    except:
        pass
    return {}

def valid_wart_token(auth_data):
    return 'user' in auth_data

def validate_simple_auth_token(token):
    """'Decodes' a token which is just the username. This is purely so I can
    test locally in an easy way. It should *never* be used in production."""
    # TODO: Eventually, this token should actually be JWT-encoded.
    return {'username': token}

def encode_wart_token(mongo_data):
    """Creates the token which will be passed to us for all future requests
    from the frontend. Also enters the token in the DB."""
    # TODO: JWT-encode this and maybe some other security.
    return None, {'username': mongo_data['username'],
                  'user': str(mongo_data['_id'])}


# Now for the actual authentication/registration methods.
class Authentication(Resource):
    def get(self):
        """GET /api/v1/auth
        Checks a provided Authorization header and replies with the
        decoded auth header if it is valid. Empty response otherwise."""
        auth_data = decode_auth_header(request.headers.get('Authorization'))
        if valid_wart_token(auth_data):
            return auth_data
        else:
            abort(401)

    def post(self):
        """POST /api/v1/auth
        Receives a 3rd-party auth token as JSON data and replies with
        a WaRT auth token if it is valid. Empty response otherwise."""
        args = request.get_json(force=True)
        db = get_db()

        decoded_token = validate_simple_auth_token(args['token'])

        # If the token is not valid, return 401.
        if 'username' not in decoded_token:
            abort(401)

        # We have a username. Make sure there is a row in the DB with upsert.
        # We don't care if the user has "registered" previously, because our
        # authentication is already handled by a 3rd-party which prevents bots.
        db.get_collection('users').update_one(
            {'username': decoded_token['username']},
            {'$set': {'username': decoded_token['username']}},
            upsert=True)
        # Now that the user is guaranteed existing, find their ObjectId.
        user_mongo = db.get_collection('users').find_one(
            {'username': decoded_token['username']})

        # We have a valid token for a valid user. Create a session for them.
        expiry_date, new_token = encode_wart_token(user_mongo)
        return {
            'expiry_date': expiry_date,
            'username': user_mongo['username'],
            'token': new_token,
        }

# Check the auth header before every request.
bp = Blueprint('auth', __name__)
@bp.before_app_request
def load_auth_user():
    check_authenticated()

api = Api(bp)
api.add_resource(Authentication, '/api/v1/auth')
