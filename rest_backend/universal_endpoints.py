from flask_restful import Resource, Api
from flask import Blueprint
import json

from rest_backend.db import get_db

bp = Blueprint('universal_endpoints', __name__)
api = Api(bp)

class UniversalEndpoints(Resource):
    def get(self):
        db = get_db()
        last_updated = None
        primesCollection = db.primes
        primes = []
        for prime in primesCollection.find():
            new_last_updated = prime['last_updated']
            if last_updated == None or new_last_updated > last_updated:
                last_updated = new_last_updated

            del prime['_id']
            del prime['last_updated']
            primes.append(prime)
        return {'last_updated': last_updated.isoformat(), 'primes': primes}

api.add_resource(UniversalEndpoints, '/universal_data')
