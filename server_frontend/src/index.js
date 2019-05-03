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
      "user_preferences": {},
      "last_updated": {},
    };
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

  updateInventoryToServer(type, itemName, itemUid, itemCount) {
    let payload = {};
    payload[type+"s_inventory"] = [{
      "uid": itemUid,
      "name": itemName,
      "count": itemCount
    }];
    axios.put("http://localhost:50001/api/v1/inventory", payload)
    .then((response) => {
      let newState = Object.assign({},this.state);
      // Update the last_updated from the response, which contains
      // the server's update time.
      newState.last_updated.inventory = response.data.last_updated;
      this.setState(newState);
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
    return (
      <Tabs>
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
            onCountChange={(a,b,c,d) => this.updateInventoryToServer(a,b,c,d)}
          />
        </TabPanel>
        <TabPanel>
          <Wishlist />
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
