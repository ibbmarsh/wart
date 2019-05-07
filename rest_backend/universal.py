from flask_restful import Resource, Api
from flask import Blueprint
import json
import pymongo

from rest_backend.db import (
    get_db,
    get_collection_last_updated_max
)
from rest_backend.auth import login_required

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

api.add_resource(Universal, '/api/v1/universal_data')
