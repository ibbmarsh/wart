import React from 'react';
import Cookies from 'universal-cookie';
import { GoogleLogin, GoogleLogout } from 'react-google-login';

class About extends React.Component {
  constructor(props) {
    super(props);
    this.state = {"username": ""};
    this.handleSimpleLogin = this.handleSimpleLogin.bind(this);
    this.handleSimpleLogout = this.handleSimpleLogout.bind(this);
    this.handleUsernameChange = this.handleUsernameChange.bind(this);
  }

  handleSimpleLogin(e) {
    if (this.state.username !== "") {
      this.props.onLogin(this.state.username);
    }
  }

  handleSimpleLogout(e) {
    this.props.onLogout();
  }

  handleUsernameChange(e) {
    this.setState({"username": e.target.value});
  }

  render() {
    // TODO: Move the auth stuff to another tab.
    const cookies = new Cookies();
    let loginButtons = [];
    // If logged in...
    if (cookies.get("username")) {
      // Show which user is logged in.
      const usernameText = `Logged in as ${cookies.get("username")}`;
      loginButtons.push(<div key="username-text">{usernameText}</div>);
      // Which logout button we provide depends on the auth method used.
      const authMethod = cookies.get("auth-method");
      if (authMethod === "google") {
        loginButtons.push(
          <GoogleLogout
            key="google-logout"
            clientId={window.google_client}
            buttonText="Logout with Google"
            onLogoutSuccess={this.props.onLogout}
            onFailure={this.props.onLoginFailure}
          />);
      } else if (authMethod === "simple") {
        loginButtons.push(
          <input
            key="simple-logout"
            type="button"
            value="Simple Logout"
            onClick={this.handleSimpleLogout}
          />);
      }
    // If not logged in, provide login buttons.
    } else {
      // Always allow Google Login.
      loginButtons.push(
        <GoogleLogin
          key="google-login"
          clientId={window.google_client}
          buttonText="Login with Google"
          onSuccess={this.props.onLogin}
          onFailure={this.props.onLoginFailure}
          cookiePolicy={'single_host_origin'}
        />);
      // Allow simple login in dev.
      if (window.server_env === "development") {
        loginButtons.push(
          <input
            key="simple-username"
            id="username_login"
            value={this.state.username}
            onChange={this.handleUsernameChange}
          />);
        loginButtons.push(
          <input
            key="simple-login"
            type="button"
            value="Simple Login"
            onClick={this.handleSimpleLogin}
          />);
      }
    }
    return (
      <div className="about-panel">
        <div>
          {loginButtons}
        </div>
        <div className="about-blather">
          <p>To use this site:</p>
          <ol>
            <li>Log in via the Google Sign-in link.</li>
            <li>Enter your entire prime inventory on the Inventory tab.</li>
            <li>Select which primes you wish to prioritize on the Wishlist page.</li>
            <li>Use the Relic Run tab when running fissures to determine which reward to pick.</li>
            <li>Use the Salables tab to determine which prime parts are safe to sell.</li>
          </ol>
          <p>Note that no data will appear until you sign in. This is mostly to reduce strain on our puny personal server, but also to reduce the potential for griefing. In case you want to know exactly what information we collect and store, you can view <a target="_blank" rel="noopener noreferrer" href="/privacy.html">WaRT's privacy policy</a>.</p>
          <p>You can find the source for this server on its <a target="_blank" rel="noopener noreferrer" href="https://github.com/ibbmarsh/wart">GitHub repo</a> and a roadmap on <a target="_blank" rel="noopener noreferrer" href="https://trac.ibbathon.com">our Trac site</a>.</p>
        </div>
      </div>
    );
  }
}

export {
  About,
};
