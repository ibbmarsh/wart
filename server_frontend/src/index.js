import React from 'react';
import ReactDOM from 'react-dom';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import { RestCalls } from './rest_calls.js';
import { About } from './about.js';
import { Inventory } from './inventory.js';
import { Wishlist } from './wishlist.js';
import { Salables } from './salables.js';
import { RelicRun } from './relicrun.js';

import {
  buildLastUpdated,
  buildBuildClickData,
} from './helpers.js';

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

    this.restCalls = new RestCalls("http://localhost:50001");
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
    };
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

  /*
   * Called when an inventory count is updated from somewhere.
   * Updates the internal state and then uses RestCalls to update the server.
   */
  onCountChange(type, name, uid, count) {
    const data = {
      uid: uid,
      name: name,
      count: count,
    };
    if (type === "prime") {
      this.updateState("primes_inventory", data);
      this.restCalls.onPrimeCountChange(data)
      .then(this.updateLastUpdated.bind(this, "inventory"))
      .catch(error => console.error(error));
    } else {
      this.updateState("parts_inventory", data);
      this.restCalls.onPartCountChange(data)
      .then(this.updateLastUpdated.bind(this, "inventory"))
      .catch(error => console.error(error));
    }
  }

  /*
   * Called when a wishlist item is updated from somewhere.
   * Updates the internal state and then uses RestCalls to update the server.
   */
  onDesiredChange(name, uid, is_desired) {
    const data = {
      uid: uid,
      name: name,
      is_desired: is_desired,
    };
    this.updateState("desired", data, {
      shouldDelete: !is_desired,
    });
    this.restCalls.onDesiredChange(data)
    .then(this.updateLastUpdated.bind(this, "desired"))
    .catch(error => console.error(error));
  }

  /*
   * Called when the build button is clicked on the wishlist.
   * Updates the internal states and then uses RestCalls to update the server.
   */
  onBuildClick(name) {
    const data = buildBuildClickData(name, this.state);
    // To keep the updateState method simple, we loop through the inventory
    // changes here, as multiple inventory changes only happen in this method.
    for (const p of data.primes_inventory) {
      this.updateState("primes_inventory", p);
    }
    for (const p of data.parts_inventory) {
      this.updateState("parts_inventory", p);
    }
    for (const d of data.desired) {
      this.updateState("desired", d, {
        shouldDelete: !d.is_desired,
      });
    }
    this.restCalls.onBuildClick(data)
    .then(this.updateLastUpdatedMultiple.bind(this,["inventory","desired"]))
    .catch(error => console.error(error));
  }

  updateLastUpdated(target, response) {
    const newLastUpdated = buildLastUpdated(
      this.state, [response.data]);
    const newState = Object.assign({}, this.state, newLastUpdated);
    this.setState(newState);
  }

  updateLastUpdatedMultiple(targets, responses) {
    for (const i in targets) {
      this.updateLastUpdated(targets[i], responses[i]);
    }
  }

  updateState(key, data, options) {
    // Set default options.
    options = Object.assign({
      shouldDelete: false,
    }, options);

    let newState = Object.assign({}, this.state);

    let foundExisting = false;
    for (const i in newState[key]) {
      // All of my states have a name property, so use that.
      if (newState[key][i].name === data.name) {
        foundExisting = true;
        // The desired state should delete, not change a bool.
        if (options.shouldDelete) {
          newState[key].splice(i,1);
        } else {
          newState[key][i] = data;
        }
        break;
      }
    }
    if (!foundExisting && !options.shouldDelete) {
      newState[key].push(data);
      // Need to sort after adding a new value.
      // The data from the server is already sorted, but manually-modified
      // state is not.
      newState[key].sort((a,b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
    }

    this.setState(newState);
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
