from flask_restful import Resource, Api
from flask import Blueprint, request

from rest_backend.auth import get_user_id
from rest_backend.db import (
    get_db,
    get_collection_last_updated_max
)

class LastUpdated(Resource):
    def get(self):
        db = get_db()
        user_id = get_user_id()

        universal_data = get_collection_last_updated_max(
            db.get_collection('primes')
        )
        universal_data = get_collection_last_updated_max(
            db.get_collection('relics'), compare_last_updated=universal_data
        )

        inventory = get_collection_last_updated_max(
            db.get_collection('primes_inventory'), user_id
        )
        inventory = get_collection_last_updated_max(
            db.get_collection('parts_inventory'), user_id, inventory
        )

        desired = get_collection_last_updated_max(
            db.get_collection('desired'), user_id
        )

        user_preferences = get_collection_last_updated_max(
            db.get_collection('user_preferences'), user_id
        )

        return {
            'universal_data': universal_data.isoformat(),
            'inventory': inventory.isoformat(),
            'desired': desired.isoformat(),
            'user_preferences': user_preferences.isoformat(),
        }

bp = Blueprint('last_updated', __name__)
api = Api(bp)
api.add_resource(LastUpdated, '/api/v1/last_updated')
