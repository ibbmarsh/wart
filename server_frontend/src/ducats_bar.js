import React from 'react';
import Collapsible from 'react-collapsible';

import {
  findItemByName,
} from './helpers.js';

import './ducats_bar.css';

class DucatsInput extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.handleDucatsChanged = this.handleDucatsChanged.bind(this);
  }

  handleDucatsChanged(e) {
    // Immediately set local state so user can freely edit.
    this.setState({"value": e.target.value});
    // Only send to server/world state if user entered valid int.
    if (e.target.value === String(parseInt(e.target.value))) {
      this.props.onUserPrefChange(this.props.name, parseInt(e.target.value));
    }
  }

  componentWillReceiveProps(nextProps) {
    // We set state to allow the user to edit the value, but we want to be
    // able to control the input value as well at higher levels.
    // The best way I've found is to unset the state when it is the same as
    // the prop. This means that when the prop finishes propagating to the
    // server and back, we'll get rid of the state.
    if (this.state.value !== undefined
      && this.state.value === String(nextProps.value))
    {
      this.setState({"value": undefined});
    }
  }

  render() {
    return (
      <div className="ducats-input">
        <label htmlFor={this.props.name}>{this.props.text}</label>
        <input
          id={this.props.name}
          value={this.state.value===undefined
                 ? this.props.value
                 : this.state.value}
          onChange={this.handleDucatsChanged}
          disabled={this.props.disabled || false}
        />
      </div>
    );
  }
}

class DucatsBar extends React.Component {
  render() {
    const prefs = [
      findItemByName("ducats_wanted", this.props.userPreferences),
      findItemByName("ducats_owned", this.props.userPreferences),
    ];
    let ducatsWanted = 0, ducatsOwned = 0;
    if (prefs[0] !== null) {ducatsWanted = prefs[0].value;}
    if (prefs[1] !== null) {ducatsOwned = prefs[1].value;}

    let ducatsExpected = 0;
    for (const spare of this.props.spareParts) {
      ducatsExpected += (spare.part.count - spare.needed) * spare.ducats;
    }

    const ducatsAfter = Math.max(0,
      ducatsWanted - (ducatsOwned + ducatsExpected));

    return (
      <div className="ducats-bar">
        <Collapsible trigger="Ducats">
          <div id="ducats-inputs">
            <DucatsInput
              name="ducats_wanted"
              text="wanted"
              value={ducatsWanted}
              onUserPrefChange={this.props.onUserPrefChange}
            />
            <DucatsInput
              name="ducats_owned"
              text="owned"
              value={ducatsOwned}
              onUserPrefChange={this.props.onUserPrefChange}
            />
            <DucatsInput
              name="ducats_expected"
              text="expected from salables"
              value={ducatsExpected}
              disabled={true}
            />
            <DucatsInput
              name="ducats_after"
              text="needed after salables"
              value={ducatsAfter}
              disabled={true}
            />
          </div>
        </Collapsible>
      </div>
    );
  }
}

export {
  DucatsBar,
};
