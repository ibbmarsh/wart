import React from 'react';

class About extends React.Component {
  render() {
    return (
      <div>
        <div>This is WaRT, the Warframe Relic Tracker.</div>
        <div>You can find the source for this server on its <a href="https://github.com/ibbmarsh/wart">GitHub repo</a>.</div>
        <div>To use this site:
          <ol>
            <li>Enter your entire prime inventory on the Inventory tab.</li>
            <li>Select which primes you wish to prioritize on the Wishlist page.</li>
            <li>Use the Relic Run tab when running fissures to determine which reward to pick.</li>
            <li>Use the Salables tab to determine which prime parts are safe to sell.</li>
          </ol>
        </div>
        <div>Note that no data will appear until you sign in. This is partially to reduce strain on my puny personal server, and partially because I do not care about your silly privacy concerns. But that's a rant for another time.</div>
      </div>
    );
  }
}

export {
  About,
};
