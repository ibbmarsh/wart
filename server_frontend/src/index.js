import React from 'react';
import ReactDOM from 'react-dom';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import { RestCalls } from './rest_calls.js';
import { About } from './about.js';
import { Inventory } from './inventory.js';
import { Wishlist } from './wishlist.js';
import { Salables } from './salables.js';
import { RelicRun } from './relicrun.js';

import { buildLastUpdated } from './helpers.js';

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

    this.checkForUpdatesOnChange = this.checkForUpdatesOnChange.bind(this);

    this.restCalls = new RestCalls("http://localhost:50001");
  }

  checkForUpdatesOnChange(result) {
    this.checkForUpdates();
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
    .then(newStateData => {
      const lastUpdated = buildLastUpdated(this.state, newStateData);
      const newState = Object.assign(
        {}, this.state,
        newStateData,
        lastUpdated);
      this.setState(newState);
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
      .then(this.checkForUpdatesOnChange)
      .catch(error => console.error(error));
    } else {
      this.restCalls.onPartCountChange(data)
      .then(this.checkForUpdatesOnChange)
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
    .then(this.checkForUpdatesOnChange)
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
    .then(this.checkForUpdatesOnChange)
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
          <Tab><div className="logo"><span className="logo-spiffy">Wa</span>rframe <span className="logo-spiffy">R</span>elic <span className="logo-spiffy">T</span>racker</div></Tab>
          <Tab>Inventory</Tab>
          <Tab>Wishlist</Tab>
          <Tab>Salables</Tab>
          <Tab>Relic Run</Tab>
        </TabList>

        <TabPanel>
          <About />
        </TabPanel>
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
          <Salables
            primes={this.state.primes}
            primesInventory={this.state.primes_inventory}
            partsInventory={this.state.parts_inventory}
            desired={this.state.desired}
            onCountChange={this.onCountChange}
          />
        </TabPanel>
        <TabPanel>
          <RelicRun
            primes={this.state.primes}
            relics={this.state.relics}
            primesInventory={this.state.primes_inventory}
            partsInventory={this.state.parts_inventory}
            desired={this.state.desired}
            onCountChange={this.onCountChange}
          />
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
