from flask_restful import Resource, Api
from flask import Blueprint, request

from rest_backend.db import (
    get_db,
    get_collection_last_updated_max,
    set_collection_last_updated
)

# TODO: Move this into a separate, helper file.
# TODO: And also have it pull from session, not a constant.
def get_user_id():
    return 0

class Inventory(Resource):
    def get(self):
        db = get_db()
        user_id = get_user_id()

        primesInventoryCollection = db.get_collection('primes_inventory')
        last_updated = get_collection_last_updated_max(
            primesInventoryCollection, user_id
        )
        primesInventory = []
        for prime in primesInventoryCollection.find({
                'user_id': user_id,
                'count': {'$gt': 0},
                'last_updated': {'$exists': False}}):
            del prime['_id']
            del prime['user_id']
            primesInventory.append(prime)

        partsInventoryCollection = db.get_collection('parts_inventory')
        last_updated = get_collection_last_updated_max(
            partsInventoryCollection, user_id, last_updated
        )
        partsInventory = []
        for part in partsInventoryCollection.find({
                'user_id': user_id,
                'count': {'$gt': 0},
                'last_updated': {'$exists': False}}):
            del part['_id']
            del part['user_id']
            partsInventory.append(part)

        return {
            'last_updated': last_updated.isoformat(),
            'primes_inventory': primesInventory,
            'parts_inventory': partsInventory,
        }

    def put(self):
        args = request.get_json(force=True)
        db = get_db()
        user_id = get_user_id()

        primesInventoryCollection = db.get_collection('primes_inventory')
        for prime in args.get('primes_inventory', []):
            prime['user_id'] = user_id
            primesInventoryCollection.update_one(
                {'name': prime['name']},
                {'$set': prime},
                upsert=True
            )
        last_updated = set_collection_last_updated(
            primesInventoryCollection, user_id
        )

        partsInventoryCollection = db.get_collection('parts_inventory')
        for part in args.get('parts_inventory', []):
            part['user_id'] = user_id
            partsInventoryCollection.update_one(
                {'name': part['name']},
                {'$set': part},
                upsert=True
            )
        new_last_updated = set_collection_last_updated(
            partsInventoryCollection, user_id
        )
        if new_last_updated > last_updated:
            last_updated = new_last_updated

        return {
            'last_updated': last_updated.isoformat(),
            'success': True
        }

bp = Blueprint('inventory', __name__)
api = Api(bp)
api.add_resource(Inventory, '/inventory')
