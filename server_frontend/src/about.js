import React from 'react';
import Cookies from 'universal-cookie';

class About extends React.Component {
  constructor(props) {
    super(props);
    this.state = {"username": ""};
    this.handleLogin = this.handleLogin.bind(this);
    this.handleUsernameChange = this.handleUsernameChange.bind(this);
  }

  handleLogin(e) {
    if (this.state.username !== "") {
      this.props.onLogin(this.state.username);
    }
  }

  handleUsernameChange(e) {
    this.setState({"username": e.target.value});
  }

  render() {
    // TODO: Move the auth stuff to another tab.
    const cookies = new Cookies();
    let usernameText = "";
    if (cookies.get("username")) {
      usernameText = `Logged in as ${cookies.get("username")}`;
    }
    return (
      <div className="about-panel">
        <div className="about-blather">
          <p>This is WaRT, the Warframe Relic Tracker.</p>
          <p>You can find the source for this server on its <a href="https://github.com/ibbmarsh/wart">GitHub repo</a> and a roadmap on <a href="https://trac.ibbathon.com">my Trac site</a>.</p>
          <p>To use this site:</p>
            <ol>
              <li>Log in via the Google Sign-in link.</li>
              <li>Enter your entire prime inventory on the Inventory tab.</li>
              <li>Select which primes you wish to prioritize on the Wishlist page.</li>
              <li>Use the Relic Run tab when running fissures to determine which reward to pick.</li>
              <li>Use the Salables tab to determine which prime parts are safe to sell.</li>
            </ol>
          <p>Note that no data will appear until you sign in. This is partially to reduce strain on my puny personal server, and partially because I do not care about your silly privacy concerns. But that's a rant for another time.</p>
        </div>
        <div>
          <label htmlFor="username_login">Username</label>
          <input id="username_login" value={this.state.username}
            onChange={this.handleUsernameChange} />
          <input type="button" value="Login" onClick={this.handleLogin} />
          <div>{usernameText}</div>
        </div>
      </div>
    );
  }
}

export {
  About,
};
