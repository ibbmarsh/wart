import React from 'react';
import ReactDOM from 'react-dom';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import { RestCalls } from './rest_calls.js';
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

    this.refreshAllOnChange = this.refreshAllOnChange.bind(this);
    this.onCountChange = this.onCountChange.bind(this);
    this.onDesiredChange = this.onDesiredChange.bind(this);
    this.onBuildClick = this.onBuildClick.bind(this);

    this.restCalls = new RestCalls("http://localhost:50001");
  }

  refreshAllOnChange(result) {
    this.refreshAllREST();
  }

  refreshAllREST() {
    this.restCalls.refreshAllREST()
    .then(newState => {
      this.setState(newState);
    })
    .catch(error => console.error(error));
  }

  checkForUpdates() {
    let data = {
      last_updated: this.state.last_updated,
    }
    this.restCalls.checkForUpdates(data)
    .then(updateNeeded => {
      if (updateNeeded) {
        this.refreshAllREST();
      }
    })
    .catch(error => console.error(error));
  }

  onCountChange(type, name, uid, count) {
    let data = {
      uid: uid,
      name: name,
      count: count,
    }
    if (type === "prime") {
      this.restCalls.onPrimeCountChange(data)
      .then(this.refreshAllOnChange)
      .catch(error => console.error(error));
    } else {
      this.restCalls.onPartCountChange(data)
      .then(this.refreshAllOnChange)
      .catch(error => console.error(error));
    }
  }

  onDesiredChange(name, uid, is_desired) {
    let data = {
      uid: uid,
      name: name,
      is_desired: is_desired,
    };
    this.restCalls.onDesiredChange(data)
    .then(this.refreshAllOnChange)
    .catch(error => console.error(error));
  }

  onBuildClick(name) {
    let data = {
      name: name,
      primes: this.state.primes,
      primes_inventory: this.state.primes_inventory,
      parts_inventory: this.state.parts_inventory,
    }
    this.restCalls.onBuildClick(data)
    .then(this.refreshAllOnChange)
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
