import axios from 'axios';

class RestCalls {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  refreshAllREST() {
    // Universal Data
    let pUniversalData = axios.get(this.baseUrl+"/api/v1/universal_data")
    .then(response => {
      return {
        "primes": response.data.primes,
        "relics": response.data.relics,
      };
    });

    // Inventory
    let pInventory = axios.get(this.baseUrl+"/api/v1/inventory")
    .then(response => {
      return {
        "parts_inventory": response.data.parts_inventory,
        "primes_inventory": response.data.primes_inventory,
      };
    });

    // Wishlist
    let pDesired = axios.get(this.baseUrl+"/api/v1/desired")
    .then(response => {
      return {
        "desired": response.data.desired,
      };
    });

    // Preferences
    let pPreferences = axios.get(this.baseUrl+"/api/v1/user_preferences")
    .then(response => {
      return {
        "user_preferences": response.data,
      };
    });

    // Last Updated
    let pLastUpdated = axios.get(this.baseUrl+"/api/v1/last_updated")
    .then(response => {
      return {
        "last_updated": response.data,
      };
    });

    // Now resolve all the promises and use their data to construct a state.
    return (
      Promise
      .all([pUniversalData, pInventory, pDesired, pPreferences, pLastUpdated])
      .then(([universalData, inventory, desired, preferences, lastUpdated]) => {
        return Object.assign({},
          universalData,
          inventory,
          desired,
          preferences,
          lastUpdated,
        );
      })
    );
  }

  checkForUpdates({last_updated}) {
    return axios.get(this.baseUrl+"/api/v1/last_updated")
    .then(response => {
      let updateNeeded = false;
      for (let k in last_updated) {
        if (last_updated[k] < response.data[k]) {
          updateNeeded = true;
          break;
        }
      }
      return updateNeeded;
    });
  }

  onPrimeCountChange({uid, name, count}) {
    return axios.put(this.baseUrl+"/api/v1/inventory", {
      "primes_inventory": [{
        "uid": uid,
        "name": name,
        "count": count,
      }]
    });
  }

  onPartCountChange({uid, name, count}) {
    return axios.put(this.baseUrl+"/api/v1/inventory", {
      "parts_inventory": [{
        "uid": uid,
        "name": name,
        "count": count,
      }]
    });
  }

  onDesiredChange({uid, name, is_desired}) {
    return axios.put(this.baseUrl+"/api/v1/desired", {
      "desired": [{
        "uid": uid,
        "name": name,
        "is_desired": is_desired,
      }]
    });
  }

  onBuildClick({name, primes, primes_inventory, parts_inventory}) {
    let inventoryPayload = {"primes_inventory":[], "parts_inventory":[]};
    let desiredPayload = {"desired":[]};

    // Find the prime we're talking about.
    let prime = null;
    for (const p of primes) {
      if (p.name === name) {
        prime = p;
        break;
      }
    }
    if (prime === null) {
      console.error("Could not find prime %s",name);
      return;
    }

    // We have the prime data, but now we need the current inventory counts
    // for the prime and each part.
    let count = 0;
    for (const p of primes_inventory) {
      if (p.name === name) {
        count = p.count;
        break;
      }
    }
    inventoryPayload.primes_inventory.push({
      "uid": prime.uid,
      "name": name,
      "count": count+1,
    });
    // Part counts now.
    for (const c of prime.components) {
      let count = 0;
      for (const p of parts_inventory) {
        if (p.name === c.name) {
          count = p.count;
          break;
        }
      }
      inventoryPayload.parts_inventory.push({
        "uid": c.uid,
        "name": c.name,
        "count": count-c.needed,
      });
    }

    // Finally, the desired payload.
    desiredPayload.desired.push({
      "uid": prime.uid,
      "name": name,
      "is_desired": false,
    });

    let axios1 = axios.put(this.baseUrl+"/api/v1/inventory",inventoryPayload);
    let axios2 = axios.put(this.baseUrl+"/api/v1/desired",desiredPayload);

    return Promise.all([axios1,axios2]);
  }
}

export {
  RestCalls,
}
