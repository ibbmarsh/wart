from flask_restful import Resource, Api
from flask import Blueprint, request

from rest_backend.auth import get_user_id, login_required
from rest_backend.db import (
    get_db,
    get_collection_last_updated_max,
    set_collection_last_updated
)

class Desired(Resource):
    method_decorators = [login_required]

    def get(self):
        db = get_db()
        user_id = get_user_id()

        desired_collection = db.get_collection('desired')
        last_updated = get_collection_last_updated_max(
            desired_collection, user_id
        )
        desired = []
        for prime in desired_collection.find({
                'user_id': user_id,
                'last_updated': {'$exists': False}}):
            del prime['_id']
            del prime['user_id']
            desired.append(prime)

        return {
            'last_updated': last_updated.isoformat(),
            'desired': desired,
        }

    def put(self):
        args = request.get_json(force=True)
        db = get_db()
        user_id = get_user_id()

        desired_collection = db.get_collection('desired')
        for prime in args.get('desired', []):
            name = prime['name']
            is_desired = prime['is_desired']
            if is_desired:
                desired_collection.update_one(
                    {'name': name, 'user_id': user_id},
                    {'$set': {
                        'name': name,
                        'user_id': user_id,
                    }},
                    upsert=True
                )
            else:
                desired_collection.delete_one(
                    {'name': name, 'user_id': user_id})
        last_updated = set_collection_last_updated(desired_collection, user_id)

        return {
            'last_updated': last_updated.isoformat(),
            'success': True
        }

bp = Blueprint('desired', __name__)
api = Api(bp)
api.add_resource(Desired, '/api/v1/desired')
