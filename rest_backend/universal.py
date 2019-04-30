from flask_restful import Resource, Api
from flask import Blueprint
import json

from rest_backend.db import (
    get_db,
    get_collection_last_updated_max
)

bp = Blueprint('universal', __name__)
api = Api(bp)

class Universal(Resource):
    def get(self):
        db = get_db()

        primesCollection = db.primes
        last_updated = get_collection_last_updated_max(primesCollection)
        primes = []
        for prime in primesCollection.find({'name':{'$exists':True}}):
            del prime['_id']
            primes.append(prime)

        relicsCollection = db.relics
        last_updated = get_collection_last_updated_max(
            relicsCollection, compare_last_updated=last_updated)
        relics = []
        for relic in relicsCollection.find({'name':{'$exists':True}}):
            del relic['_id']
            relics.append(relic)

        return {
            'last_updated': last_updated.isoformat(),
            'primes': primes,
            'relics': relics,
        }

api.add_resource(Universal, '/universal_data')
