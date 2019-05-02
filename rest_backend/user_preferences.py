from flask_restful import Resource, Api
from flask import Blueprint, request

from rest_backend.auth import get_user_id
from rest_backend.db import (
    get_db,
    get_collection_last_updated_max,
    set_collection_last_updated
)

class UserPreferences(Resource):
    VALID_PREFERENCES = [
    ]

    def is_valid_preference(self, key):
        if key not in self.VALID_PREFERENCES:
            return False
        return True

    def get(self):
        db = get_db()
        user_id = get_user_id()

        user_preferences_collection = db.get_collection('user_preferences')
        user_preferences = user_preferences_collection.find_one(
            {'user_id': user_id})

        del user_preferences['_id']
        del user_preferences['user_id']
        user_preferences['last_updated'] = \
            user_preferences['last_updated'].isoformat()

        return user_preferences

    def put(self):
        args = request.get_json(force=True)
        db = get_db()
        user_id = get_user_id()

        user_preferences = {}
        for k in args:
            if self.is_valid_preference(k):
                user_preferences[k] = args[k]
        user_preferences['user_id'] = user_id
        user_preferences['last_updated'] = None

        user_preferences_collection = db.get_collection('user_preferences')
        user_preferences_collection.update_one(
            {'user_id': user_id},
            {'$set': user_preferences},
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
