import React from 'react';

import './inventory.css';

class PrimeItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e) {
    this.setState({"count": e.target.value});
    let newValue = e.target.value;
    if (newValue === String(parseInt(newValue))) {
      this.props.onCountChange(
        this.props.type,
        this.props.datakey,
        parseInt(newValue)
      );
    }
  }

  componentWillReceiveProps(nextProps) {
    // We set state to allow the user to edit the value, but we want to be
    // able to control the input value as well at higher levels.
    // The best way I've found is to unset the state when it is the same as
    // the prop. This means that when the prop finishes propagating to the
    // server and back, we'll get rid of the state.
    if (this.state.count !== undefined
      && this.state.count === String(nextProps.item.count))
    {
      this.setState({"count": undefined});
    }
  }

  render() {
    let neededText = "";
    if (this.props.item.needed !== undefined) {
      neededText = "/"+this.props.item.needed;
    }

    // Strip off parent name and "blueprint" as they are
    // not necessary in table format
    let labelText = this.props.item.name;
    if (this.props.parentName !== undefined) {
      labelText = labelText.replace(this.props.parentName+' ','');
    }
    if (labelText.match(/ Blueprint/)) {
      labelText = labelText.replace(' Blueprint','');
    }

    const primeId = this.props.item.name
                    .toLowerCase()
                    .replace(/ /g,"_");

    const count = this.props.item.count;

    return (
      <div className={this.props.type}>
        <label htmlFor={primeId}>{labelText}</label>
        <input
          id={primeId}
          value={this.state.count===undefined ? count : this.state.count}
          onChange={this.handleChange}
        />
        <span className="needed">{neededText}</span>
      </div>
    );
  }
}

class PrimeRow extends React.Component {
  render() {
    let parts=[];
    for (const p of this.props.parts) {
      parts.push(
        <PrimeItem
          key={p.name}
          datakey={p.name}
          item={p}
          parentName={this.props.prime.name}
          type="part"
          onCountChange={this.props.onCountChange}
        />
      );
    }

    return (
      <div className="prime_row">
        <PrimeItem
          key={this.props.prime.name}
          datakey={this.props.prime.name}
          item={this.props.prime}
          type="prime"
          onCountChange={this.props.onCountChange}
        />
        <div className="parts">
          {parts}
        </div>
      </div>
    );
  }
}

class Inventory extends React.Component {
  render() {
    let primes = [];
    for (const p of this.props.primes) {
      let prime = {
        "name": p.name,
        "count": 0
      };
      // Get the count of prime itself.
      for (const pi of this.props.primesInventory) {
        if (prime.name === pi.name) {
          prime.count = pi.count;
          break;
        }
      }
      // Get the counts and details for each part.
      let parts = [];
      for (const pi of p.components) {
        let part = {
          "name": pi.name,
          "needed": pi.needed,
          "count": 0
        };
        // Get the counts for the part.
        for (const ppi of this.props.partsInventory) {
          if (part.name === ppi.name) {
            part.count = ppi.count;
            break;
          }
        }
        // Put this part on the stack. Further processing in PrimeRow.
        parts.push(part);
      }
      // We have all the parts/counts. Build a PrimeRow and put it on
      // the stack for the render return.
      primes.push(
        <PrimeRow
          key={prime.name+" row"}
          prime={prime}
          parts={parts}
          onCountChange={this.props.onCountChange}
        />
      );
    }

    return (
      <div className="primes_list">
        {primes}
      </div>
    );
  }
}

export {
  Inventory,
};
