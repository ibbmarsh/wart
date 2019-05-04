import React from 'react';

import {
  findPrimeAndComponentFromPartName,
  findOwnedByName,
} from './helpers.js';

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
      this.props.part.uid,
      this.props.needed
    );
  }

  handleDucatClicked(e) {
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
    let salables = [];
    for (const part of this.props.partsInventory) {
      // We have 3 checks to perform:
      // 1) Is the corresponding prime owned?
      // 2) Is the corresponding prime desired?
      // 3) Do we have more parts than needed?

      // All 3 checks require finding the prime data first.
      let [prime, component] =
        findPrimeAndComponentFromPartName(part.name, this.props.primes);
      if (prime === null) {
        console.error("Failed to find prime corresponding to part %s",
          part.name);
        continue;
      }

      // 1) Check if the prime is owned.
      let owned = findOwnedByName(prime.name, this.props.primesInventory) > 0;

      // 2) Check if the prime is desired.
      let desired = findOwnedByName(prime.name, this.props.desired) > 0;

      // 3) Use the two previous checks to see if we need this part.
      let needed = 0;
      if (desired || !owned) {
        needed = component.needed;
      }

      // 3) Only add it to the salables if we have spare parts.
      if (part.count > needed) {
        salables.push(
          <SalablesRow
            key={part.name+" row"}
            part={part}
            needed={needed}
            ducats={component.ducats}
            onCountChange={this.props.onCountChange}
          />
        );
      }
    }

    return (
      <div className="salables-list">
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
