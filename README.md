# WaRT
Warframe Relic Tracker

## Setup

### Dependencies
You should only need docker and docker-compose installed locally.

### Initial startup
You will need to run the following in order to install dependencies inside the containers.
```
docker-compose run data_gatherer npm install
docker-compose run rest_backend pip install --user -r requirements.pip
```
