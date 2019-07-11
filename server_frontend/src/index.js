import React from 'react';
import ReactDOM from 'react-dom';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Cookies from 'universal-cookie';

import { RestCalls } from './rest_calls.js';
import { About } from './about.js';
import { Inventory } from './inventory.js';
import { Wishlist } from './wishlist.js';
import { Salables } from './salables.js';
import { RelicRun } from './relicrun.js';
import { PrimeEditor } from './prime_editor.js';

import {
  buildLastUpdated,
  buildBuildClickData,
  themeNameToPath,
} from './helpers.js';

import './common.css';
import './index.css';

class WaRT extends React.Component {
  constructor(props) {
    super(props);
    // Set a default state before we try to render.
    this.defaultState = {
      "primes": [],
      "relics": [],
      "primes_inventory": [],
      "parts_inventory": [],
      "desired": [],
      "user_preferences": [],
      "last_updated": {},
      "theme": "light",
    };
    this.state = Object.assign({}, this.defaultState);

    this.onLogin = this.onLogin.bind(this);
    this.onLogout = this.onLogout.bind(this);
    this.onLoginFailure = this.onLoginFailure.bind(this);
    this.onCountChange = this.onCountChange.bind(this);
    this.onDesiredChange = this.onDesiredChange.bind(this);
    this.onUserPrefChange = this.onUserPrefChange.bind(this);
    this.onBuildClick = this.onBuildClick.bind(this);
    this.onPrimeDataChange = this.onPrimeDataChange.bind(this);

    this.handleThemeChange = this.handleThemeChange.bind(this);

    this.restCalls = new RestCalls(window.rest_uri);
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
   * Called when the user clicks login.
   */
  onLogin(token) {
    // Tell WaRT to log us in (using given token from Google Auth).
    this.restCalls.login(token)
    .then(response => {
      // token will only be available if login was successful.
      if (response.data.username) {
        const cookies = new Cookies();
        cookies.set("username",response.data.username);
        cookies.set("auth-method",response.data.auth_method);
        // We're logged in, so fill in the data.
        this.gatherDataAndStartUpdater();
      }
    })
    .catch(error => console.error(error));
  }

  /*
   * Called when the user clicks logout.
   */
  onLogout() {
    // Tell WaRT backend to log us out.
    this.restCalls.logout();
    // Remove auth cookies and erase state so we're logged out on frontend.
    const cookies = new Cookies();
    cookies.remove("username");
    cookies.remove("auth-method");
    this.setState(Object.assign({}, this.defaultState));
    if ('checkIntervalID' in this.state) {
      clearInterval(this.state.checkIntervalID);
    }
  }

  /*
   * Called when the user fails to login or logout.
   */
  onLoginFailure(error) {
    console.error(error);
  }

  /*
   * Called when an inventory count is updated from somewhere.
   * Updates the internal state and then uses RestCalls to update the server.
   */
  onCountChange(type, name, count) {
    const data = {
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
  onDesiredChange(name, is_desired) {
    const data = {
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
   * Called whenever a user preference is changed.
   * Updates the internal states and then uses RestCalls to update the server.
   */
  onUserPrefChange(name, value) {
    const data = {
      name: name,
      value: value,
    };
    this.updateState("user_preferences", data);
    this.restCalls.onUserPrefChange(data)
    .then(this.updateLastUpdated.bind(this, "user_preferences"))
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

  /**
   * Called when the prime data is changed (in the prime editor tab,
   * only available to the admin).
   */
  onPrimeDataChange(name, text) {
    this.updateState("primes", text);
    this.restCalls.onPrimeDataChange(text)
    .then(this.updateLastUpdated.bind(this, "universal_data"))
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
    // Check if we have an existing session.
    this.restCalls.checkToken()
    .then(response => {
      // If so, fill in the data.
      this.gatherDataAndStartUpdater();
    })
    .catch(error => {
      // Cookies are invalid, so get rid of them.
      const cookies = new Cookies();
      cookies.remove("username");
      cookies.remove("auth-method");
    });

    // Check for theme cookie.
    const cookies = new Cookies();
    const theme = cookies.get("theme");
    if (theme !== undefined) {
      this.changeTheme(theme);
    }
  }

  gatherDataAndStartUpdater() {
    this.refreshAllREST();

    // Set up a periodic check for updates
    let checkInterval = 60000; // 1 minute for prod/staging
    if (window.server_env === "development") {
      checkInterval = 10000; // 10 seconds for development
    }
    const checkIntervalID = setInterval(
      () => {this.checkForUpdates()},
      checkInterval
    );
    const newState = Object.assign(
      {},
      this.state,
      {"checkIntervalID": checkIntervalID}
    );
    this.setState(newState);
  }

  handleThemeChange(e) {
    const newTheme = e.target.dataset.theme;
    this.changeTheme(newTheme);
  }

  changeTheme(newTheme) {
    const cookies = new Cookies();
    cookies.set("theme", newTheme);
    const newState = Object.assign({}, this.state, {
      "theme": newTheme
    });
    this.setState(newState);
  }

  render() {
    const stylePath = themeNameToPath(this.state.theme);
    // Only show the prime editor tab if we're logged in as the admin user
    // TODO: un-hardcode the admin user email address
    const cookies = new Cookies();
    let primeEditorTab = '';
    let primeEditorPanel = '';
    if (cookies.get('username') === 'doctorfears@gmail.com') {
      primeEditorTab = (<Tab>Prime Editor</Tab>);
      primeEditorPanel = (
        <TabPanel>
          <PrimeEditor
            primes={this.state.primes}
            onPrimeDataChange={this.onPrimeDataChange}
          />
        </TabPanel>
      );
    }
    return (
      <Tabs>
        <link rel="stylesheet" type="text/css" href={stylePath} />
        <div id="theme-buttons">
          <input type="button" value="Light" data-theme="light"
            className={this.state.theme === "light" ? "selected" : ""}
            onClick={this.handleThemeChange} />
          <input type="button" value="Dark" data-theme="dark"
            className={this.state.theme === "dark" ? "selected" : ""}
            onClick={this.handleThemeChange} />
        </div>
        <TabList>
          <Tab data-tab="about"><div className="logo"><span className="logo-spiffy">Wa</span>rframe <span className="logo-spiffy">R</span>elic <span className="logo-spiffy">T</span>racker</div></Tab>
          <Tab>Inventory</Tab>
          <Tab>Wishlist</Tab>
          <Tab>Salables</Tab>
          <Tab>Relic Run</Tab>
          {primeEditorTab}
        </TabList>

        <TabPanel>
          <About
            onLogin={this.onLogin}
            onLogout={this.onLogout}
            onLoginFailure={this.onLoginFailure}
          />
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
            userPreferences={this.state.user_preferences}
            onCountChange={this.onCountChange}
            onUserPrefChange={this.onUserPrefChange}
          />
        </TabPanel>
        <TabPanel>
          <RelicRun
            primes={this.state.primes}
            relics={this.state.relics}
            primesInventory={this.state.primes_inventory}
            partsInventory={this.state.parts_inventory}
            desired={this.state.desired}
            userPreferences={this.state.user_preferences}
            onCountChange={this.onCountChange}
            onUserPrefChange={this.onUserPrefChange}
          />
        </TabPanel>
        {primeEditorPanel}
      </Tabs>
    );
  }
}

// ========================================

ReactDOM.render(
  <WaRT />,
  document.getElementById('root')
);
