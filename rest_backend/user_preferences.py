from flask_restful import Resource, Api
from flask import Blueprint, request

from rest_backend.auth import get_user_id, login_required
from rest_backend.db import (
    get_db,
    get_collection_last_updated_max,
    set_collection_last_updated
)

class UserPreferences(Resource):
    method_decorators = [login_required]

    def get(self):
        db = get_db()
        user_id = get_user_id()

        user_preferences_collection = db.get_collection('user_preferences')
        last_updated = get_collection_last_updated_max(
            user_preferences_collection, user_id
        )
        user_preferences = []
        for pref in user_preferences_collection.find({
                'user_id': user_id,
                'last_updated': {'$exists': False}}) \
                .sort('name'):
            del pref['_id']
            del pref['user_id']
            user_preferences.append(pref)

        return {
            'last_updated': last_updated.isoformat(),
            'user_preferences': user_preferences,
        }

    def put(self):
        args = request.get_json(force=True)
        db = get_db()
        user_id = get_user_id()

        user_preferences_collection = db.get_collection('user_preferences')
        for pref in args.get('user_preferences', []):
            pref['user_id'] = user_id
            user_preferences_collection.update_one(
                {'name': pref['name'], 'user_id': user_id},
                {'$set': pref},
                upsert=True
            )
        last_updated = set_collection_last_updated(
            user_preferences_collection, user_id
        )

        return {
            'last_updated': last_updated.isoformat(),
            'success': True
        }

bp = Blueprint('user_preferences', __name__)
api = Api(bp)
api.add_resource(UserPreferences, '/api/v1/user_preferences')
