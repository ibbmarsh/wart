from flask_restful import Resource, Api, abort
from flask import Blueprint, request, current_app
import json
import pymongo

from rest_backend.db import (
    get_db,
    get_collection_last_updated_max,
    set_collection_last_updated,
)
from rest_backend.auth import login_required, get_user_id

bp = Blueprint('universal', __name__)
api = Api(bp)

class Universal(Resource):
    method_decorators = [login_required]

    def get(self):
        db = get_db()

        primes_collection = db.primes
        last_updated = get_collection_last_updated_max(primes_collection)
        primes = []
        for prime in primes_collection \
                     .find({'name':{'$exists':True}}) \
                     .sort('name'):
            del prime['_id']
            prime['components'].sort(key=lambda c: c['name'])
            primes.append(prime)

        relics_collection = db.relics
        last_updated = get_collection_last_updated_max(
            relics_collection, compare_last_updated=last_updated)
        relics = []
        for relic in relics_collection \
                     .find({'name':{'$exists':True}}) \
                     .sort([('era_num', pymongo.ASCENDING), \
                            ('code_padded', pymongo.ASCENDING)]):
            del relic['_id']
            relics.append(relic)

        return {
            'last_updated': last_updated.isoformat(),
            'primes': primes,
            'relics': relics,
        }

    def put(self):
        # Only allow puts if it's me
        user_id = get_user_id()
        if user_id != current_app.config['WART_ADMIN_ID']:
            abort(403)

        args = request.get_json(force=True)
        db = get_db()
        primes_collection = db.primes
        relics_collection = db.relics

        # Update the prime itself
        primes_collection.update_one(
            {'name': args['name']},
            {'$set': args}
        )

        # Now find and update each of the relics associated with this prime
        for component in args['components']:
            for relic_name in component['relics']:
                relic_object = relics_collection.find_one(
                    {'name': relic_name}
                )
                if not relic_object:
                    continue
                for reward in relic_object['rewards']:
                    if reward['name'] == component['name']:
                        reward['ducats'] = component['ducats']
                relics_collection.update_one(
                    {'name': relic_name},
                    {'$set': relic_object}
                )

        # Update the last_updated for both relics and primes
        last_updated = set_collection_last_updated(primes_collection)
        set_collection_last_updated(relics_collection, None, last_updated)

        return {
            'last_updated': last_updated.isoformat(),
            'success': True,
        }

api.add_resource(Universal, '/api/v1/universal_data')
