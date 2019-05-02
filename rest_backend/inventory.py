from flask_restful import Resource, Api
from flask import Blueprint, request

from rest_backend.auth import get_user_id
from rest_backend.db import (
    get_db,
    get_collection_last_updated_max,
    set_collection_last_updated
)

class Inventory(Resource):
    def get(self):
        db = get_db()
        user_id = get_user_id()

        primes_inventory_collection = db.get_collection('primes_inventory')
        last_updated = get_collection_last_updated_max(
            primes_inventory_collection, user_id
        )
        primes_inventory = []
        for prime in primes_inventory_collection.find({
                'user_id': user_id,
                'count': {'$gt': 0},
                'last_updated': {'$exists': False}}):
            del prime['_id']
            del prime['user_id']
            primes_inventory.append(prime)

        parts_inventory_collection = db.get_collection('parts_inventory')
        last_updated = get_collection_last_updated_max(
            parts_inventory_collection, user_id, last_updated
        )
        parts_inventory = []
        for part in parts_inventory_collection.find({
                'user_id': user_id,
                'count': {'$gt': 0},
                'last_updated': {'$exists': False}}):
            del part['_id']
            del part['user_id']
            parts_inventory.append(part)

        return {
            'last_updated': last_updated.isoformat(),
            'primes_inventory': primes_inventory,
            'parts_inventory': parts_inventory,
        }

    def put(self):
        args = request.get_json(force=True)
        db = get_db()
        user_id = get_user_id()

        primes_inventory_collection = db.get_collection('primes_inventory')
        for prime in args.get('primes_inventory', []):
            prime['user_id'] = user_id
            primes_inventory_collection.update_one(
                {'name': prime['name']},
                {'$set': prime},
                upsert=True
            )
        last_updated = set_collection_last_updated(
            primes_inventory_collection, user_id
        )

        parts_inventory_collection = db.get_collection('parts_inventory')
        for part in args.get('parts_inventory', []):
            part['user_id'] = user_id
            parts_inventory_collection.update_one(
                {'name': part['name']},
                {'$set': part},
                upsert=True
            )
        new_last_updated = set_collection_last_updated(
            parts_inventory_collection, user_id
        )
        if new_last_updated > last_updated:
            last_updated = new_last_updated

        return {
            'last_updated': last_updated.isoformat(),
            'success': True
        }

bp = Blueprint('inventory', __name__)
api = Api(bp)
api.add_resource(Inventory, '/api/v1/inventory')
