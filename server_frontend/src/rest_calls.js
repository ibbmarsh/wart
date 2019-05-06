import axios from 'axios';

import { buildLastUpdated } from './helpers.js';

class RestCalls {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  refreshAllREST() {
    const promises = [
      this.updateUniversalData(),
      this.updateInventory(),
      this.updateDesired(),
      this.updateUserPreferences(),
    ]

    // Now resolve all the promises and use their data to construct a state.
    return (
      Promise
      .all(promises)
      .then(states => {
        const lastUpdated = buildLastUpdated(...states);
        return Object.assign({},...states,lastUpdated);
      })
    );
  }

  checkForUpdates({last_updated}) {
    return axios.get(this.baseUrl+"/api/v1/last_updated")
    .then(response => {
      let promises = [];
      for (let k in last_updated) {
        if (last_updated[k] < response.data[k]) {
          if (k === "universal_data") {
            promises.push(this.updateUniversalData());
          } else if (k === "inventory") {
            promises.push(this.updateInventory());
          } else if (k === "desired") {
            promises.push(this.updateDesired());
          } else if (k === "user_preferences") {
            promises.push(this.updateUserPreferences());
          }
        }
      }

      // Now resolve all the promises and use their data to construct a
      // state delta.
      return (
        Promise
        .all(promises)
        .then(states => {
          return Object.assign({},...states);
        })
      );
    });
  }

  updateUniversalData() {
    return axios.get(this.baseUrl+"/api/v1/universal_data")
    .then(response => {
      return {
        "primes": response.data.primes,
        "relics": response.data.relics,
        "last_updated": {
          "universal_data": response.data.last_updated
        },
      };
    });
  }

  updateInventory() {
    return axios.get(this.baseUrl+"/api/v1/inventory")
    .then(response => {
      return {
        "parts_inventory": response.data.parts_inventory,
        "primes_inventory": response.data.primes_inventory,
        "last_updated": {
          "inventory": response.data.last_updated
        },
      };
    });
  }

  updateDesired() {
    return axios.get(this.baseUrl+"/api/v1/desired")
    .then(response => {
      return {
        "desired": response.data.desired,
        "last_updated": {
          "desired": response.data.last_updated
        },
      };
    });
  }

  updateUserPreferences() {
    return axios.get(this.baseUrl+"/api/v1/user_preferences")
    .then(response => {
      return {
        "user_preferences": response.data.user_preferences,
        "last_updated": {
          "user_preferences": response.data.last_updated
        },
      };
    });
  }

  onPrimeCountChange({name, count}) {
    return axios.put(this.baseUrl+"/api/v1/inventory", {
      "primes_inventory": [{
        "name": name,
        "count": count,
      }]
    });
  }

  onPartCountChange({name, count}) {
    return axios.put(this.baseUrl+"/api/v1/inventory", {
      "parts_inventory": [{
        "name": name,
        "count": count,
      }]
    });
  }

  onDesiredChange({name, is_desired}) {
    return axios.put(this.baseUrl+"/api/v1/desired", {
      "desired": [{
        "name": name,
        "is_desired": is_desired,
      }]
    });
  }

  onUserPrefChange({name, value}) {
    return axios.put(this.baseUrl+"/api/v1/user_preferences", {
      "user_preferences": [{
        "name": name,
        "value": value,
      }]
    });
  }

  onBuildClick(data) {
    let inventoryPayload = {
      "primes_inventory": data.primes_inventory,
      "parts_inventory": data.parts_inventory,
    }
    let desiredPayload = {
      "desired": data.desired,
    }

    let axios1 = axios.put(this.baseUrl+"/api/v1/inventory",inventoryPayload);
    let axios2 = axios.put(this.baseUrl+"/api/v1/desired",desiredPayload);

    return Promise.all([axios1,axios2]);
  }
}

export {
  RestCalls,
}
