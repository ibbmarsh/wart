import React from 'react';

class WishlistRow extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.handleDesiredChange = this.handleDesiredChange.bind(this);
    this.handleBuildClick = this.handleBuildClick.bind(this);
  }

  handleDesiredChange(e) {
    // Immediately set local state so user can freely edit.
    this.setState({"desired":e.target.checked});
    this.props.onDesiredChange(
      this.props.prime.name,
      e.target.checked
    );
  }

  handleBuildClick(e) {
    this.props.onBuildClick(this.props.prime.name);
  }

  componentWillReceiveProps(nextProps) {
    // If our world state now matches our local state, delete local state.
    if (this.state.desired !== undefined
      && this.state.desired === nextProps.prime.desired)
    {
      this.setState({"desired": undefined});
    }
  }

  render() {
    const primeId = this.props.prime.name
                    .toLowerCase()
                    .replace(/ /g,"_");
    return (
      <div className="wishlist-row">
        <label htmlFor={primeId}>{this.props.prime.name}</label>
        <input
          id={primeId}
          type="checkbox"
          checked={this.state.desired===undefined
                   ? this.props.prime.desired
                   : this.state.desired}
          onChange={this.handleDesiredChange}
        />
        <input
          id={primeId+"_build"}
          type="button"
          value="Build"
          disabled={!this.props.prime.buildable}
          onClick={this.handleBuildClick}
        />
      </div>
    );
  }
}

class Wishlist extends React.Component {
  primeIsBuildable(prime, partsInventory) {
    for (const c of prime.components) {
      let partFound = false;
      for (const p of partsInventory) {
        if (c.name === p.name && p.count >= c.needed) {
          partFound = true;
          break;
        }
      }
      if (!partFound) {
        return false;
      }
    }

    // We didn't fail to find any needed parts, so the prime is buildable.
    return true;
  }

  render() {
    let primes = [];
    for (const p of this.props.primes) {
      let prime = {
        "name": p.name,
        "desired": false,
        "buildable": this.primeIsBuildable(p,this.props.partsInventory),
      };
      // Check whether prime is desired.
      for (const w of this.props.desired) {
        if (w.name === p.name) {
          prime.desired = true;
          break;
        }
      }
      // We have all the data for this wishlist item. Build a WishlistRow
      // and put it on the stack for the render return.
      primes.push(
        <WishlistRow
          key={prime.name+" row"}
          prime={prime}
          onDesiredChange={this.props.onDesiredChange}
          onBuildClick={this.props.onBuildClick}
        />
      );
    }

    return (
      <div className="wishlist-list">
        {primes}
      </div>
    );
  }
}

export {
  Wishlist,
};
