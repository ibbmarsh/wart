import React from 'react';

import { DucatsBar } from './ducats_bar.js';

import {
  findItemByName,
  gatherSpareParts,
} from './helpers.js';

import './salables.css';

class SalablesRow extends React.Component {
  constructor(props) {
    super(props);
    this.handleDucatClicked = this.handleDucatClicked.bind(this);
    this.handlePlatClicked = this.handlePlatClicked.bind(this);
  }

  sellPart() {
    this.props.onCountChange(
      "part",
      this.props.part.name,
      this.props.needed
    );
  }

  handleDucatClicked(e) {
    // Find the current amount of ducats.
    let ducatsOwned = 0;
    const ducatsOwnedPref = findItemByName("ducats_owned",
      this.props.userPreferences);
    if (ducatsOwnedPref !== null) {
      ducatsOwned = ducatsOwnedPref.value;
    }

    // Increment by the amount this sale would get us.
    ducatsOwned +=
      (this.props.part.count - this.props.needed) * this.props.ducats;

    // Send the state updates.
    this.props.onUserPrefChange("ducats_owned", ducatsOwned);
    this.sellPart();
  }

  handlePlatClicked(e) {
    this.sellPart();
  }

  render() {
    const spare = this.props.part.count - this.props.needed;
    const ducatsTotal = spare * this.props.ducats;

    return (
      <div className="salables-row">
        <label>
          {this.props.part.name} x{spare}
        </label>
        <input
          className="ducats"
          type="button"
          value={"Sell for "+ducatsTotal+" ducats"}
          onClick={this.handleDucatClicked}
        />
        <input
          className="plat"
          type="button"
          value={"Sell for plat"}
          onClick={this.handlePlatClicked}
        />
      </div>
    );
  }
}

class Salables extends React.Component {
  render() {
    const spareParts = gatherSpareParts(
      this.props.primes,
      this.props.primesInventory,
      this.props.partsInventory,
      this.props.desired
    );
    let salables = [];
    for (const spare of spareParts) {
      salables.push(
        <SalablesRow
          key={spare.part.name+" row"}
          part={spare.part}
          needed={spare.needed}
          ducats={spare.ducats}
          onCountChange={this.props.onCountChange}
          userPreferences={this.props.userPreferences}
          onUserPrefChange={this.props.onUserPrefChange}
        />
      );
    }

    return (
      <div className="salables-list">
        <DucatsBar
          spareParts={spareParts}
          userPreferences={this.props.userPreferences}
          onUserPrefChange={this.props.onUserPrefChange}
        />
        <div className="description">
          Below is a list of all the excess prime parts in your inventory.
          You are free to sell any of them for ducats or plat.
        </div>
        {salables}
      </div>
    );
  }
}

export {
  Salables,
};
