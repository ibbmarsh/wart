import React from 'react';
import ReactDOM from 'react-dom';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import axios from 'axios';

import { Inventory } from './inventory.js';
import { Wishlist } from './wishlist.js';
import { Salables } from './salables.js';
import { RelicRun } from './relicrun.js';

import './index.css';

class WaRT extends React.Component {
  constructor(props) {
    super(props);
    // Set a default state before we try to render.
    this.state = {
      "primes": [],
      "relics": [],
      "primes_inventory": [],
      "parts_inventory": [],
      "desired": [],
      "user_preferences": {},
      "last_updated": {},
    };

    this.onCountChange = this.onCountChange.bind(this);
    this.onDesiredChange = this.onDesiredChange.bind(this);
    this.onBuildClick = this.onBuildClick.bind(this);
  }

  refreshAllREST() {
    // Universal Data
    axios.get("http://localhost:50001/api/v1/universal_data")
    .then(response => {
      const newState = Object.assign(
        {},
        this.state,
        {
          "primes": response.data.primes,
          "relics": response.data.relics,
        }
      );
      this.setState(newState);
    })
    .catch(error => console.error(error));

    // Inventory
    axios.get("http://localhost:50001/api/v1/inventory")
    .then(response => {
      const newState = Object.assign(
        {},
        this.state,
        {
          "parts_inventory": response.data.parts_inventory,
          "primes_inventory": response.data.primes_inventory,
        }
      );
      this.setState(newState);
    })
    .catch(error => console.error(error));

    // Wishlist
    axios.get("http://localhost:50001/api/v1/desired")
    .then(response => {
      const newState = Object.assign(
        {},
        this.state,
        {
          "desired": response.data.desired,
        }
      );
      this.setState(newState);
    })
    .catch(error => console.error(error));

    // Preferences
    axios.get("http://localhost:50001/api/v1/user_preferences")
    .then(response => {
      const newState = Object.assign(
        {},
        this.state,
        {
        }
      );
      this.setState(newState);
    })
    .catch(error => console.error(error));

    // Last Updated
    axios.get("http://localhost:50001/api/v1/last_updated")
    .then(response => {
      const newState = Object.assign(
        {},
        this.state,
        {
          "last_updated": response.data,
        }
      );
      this.setState(newState);
    })
    .catch(error => console.error(error));
  }

  onCountChange(type, itemName, itemUid, itemCount) {
    let payload = {};
    payload[type+"s_inventory"] = [{
      "uid": itemUid,
      "name": itemName,
      "count": itemCount
    }];
    axios.put("http://localhost:50001/api/v1/inventory", payload)
    .then((response) => {
      this.refreshAllREST();
    })
    .catch(error => console.error(error));
  }

  onDesiredChange(name, uid, desired) {
    const payload = {"desired":[{
      "name": name,
      "uid": uid,
      "is_desired": desired,
    }]};
    axios.put("http://localhost:50001/api/v1/desired", payload)
    .then((response) => {
      this.refreshAllREST();
    })
    .catch(error => console.error(error));
  }

  onBuildClick(name) {
    let inventoryPayload = {"primes_inventory":[], "parts_inventory":[]};
    let desiredPayload = {"desired":[]};

    // Find the prime we're talking about.
    let prime = null;
    for (const p of this.state.primes) {
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
    for (const p of this.state.primes_inventory) {
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
      for (const p of this.state.parts_inventory) {
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

    axios.put("http://localhost:50001/api/v1/inventory",inventoryPayload)
    .then(response => {
      return axios.put("http://localhost:50001/api/v1/desired",desiredPayload)
    })
    .then(response => {
      this.refreshAllREST();
    })
    .catch(error => console.error(error));
  }

  checkForUpdates() {
    axios
    .get("http://localhost:50001/api/v1/last_updated")
    .then(response => {
      let updateNeeded = false;
      for (let k in this.state.last_updated) {
        if (this.state.last_updated[k] < response.data[k]) {
          updateNeeded = true;
          break;
        }
      }
      if (updateNeeded) {
        this.refreshAllREST();
      }
    })
    .catch(error => console.error(error));
  }

  componentDidMount() {
    this.refreshAllREST();

    // Set up a periodic check for updates
    const checkIntervalID = setInterval(
      () => {this.checkForUpdates()},
      10000
    );
    const newState = Object.assign(
      {},
      this.state,
      {"checkIntervalID": checkIntervalID}
    );
    this.setState(newState);
  }

  render() {
    // TODO: remove defaultIndex from Tabs; it is only for rapidly testing a tab
    return (
      <Tabs defaultIndex={1} >
        <TabList>
          <Tab>Inventory</Tab>
          <Tab>Wishlist</Tab>
          <Tab>Salables</Tab>
          <Tab>Relic Run</Tab>
        </TabList>

        <TabPanel>
          <Inventory
            primes={this.state.primes}
            primesInventory={this.state.primes_inventory}
            partsInventory={this.state.parts_inventory}
            onCountChange={this.onCountChange}
          />
        </TabPanel>
        <TabPanel>
          <Wishlist
            primes={this.state.primes}
            partsInventory={this.state.parts_inventory}
            desired={this.state.desired}
            onDesiredChange={this.onDesiredChange}
            onBuildClick={this.onBuildClick}
          />
        </TabPanel>
        <TabPanel>
          <Salables />
        </TabPanel>
        <TabPanel>
          <RelicRun />
        </TabPanel>
      </Tabs>
    );
  }
}

// ========================================

ReactDOM.render(
  <WaRT />,
  document.getElementById('root')
);
