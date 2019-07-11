import React from 'react';

import './prime_editor.css';

class PrimeEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {'name': ''};
    this.handleNameChange = this.handleNameChange.bind(this);
    this.handleTextChange = this.handleTextChange.bind(this);
  }

  handleNameChange(e) {
    // Reset the text state, in case the new prop hasn't come along yet
    let newState = Object.assign({}, this.state);
    newState.text = undefined;
    // And set the new name state to the selected item
    newState.name = e.target.value;
    this.setState(newState);
  }

  handleTextChange(e) {
    const newState = Object.assign({}, this.state, {
      text: e.target.value
    });
    this.setState(newState);
    // Only fire the callback if the text is valid JSON
    try {
      const newData = JSON.parse(e.target.value);
      this.props.onPrimeDataChange(this.state.name, newData);
    } catch(err) {}
  }

  componentWillReceiveProps(nextProps) {
    // Determine if the new props exactly match the current state.
    // If so, unset the state.
    if (this.state.text !== undefined) {
      for (const prime of this.props.primes) {
        if (this.state.name === prime.name) {
          try {
            const stateprime = JSON.parse(this.state.text);
            if (stateprime === prime) {
              let newState = Object.assign({}, this.state);
              newState.text = undefined;
              this.setState(newState);
            }
          } catch {}
          break;
        }
      }
    }
  }

  render() {
    // Build the list of primes to put as options in the selector
    let options = [
      <option key="blank" value=""></option>
    ];
    let text = {};
    for (const prime of this.props.primes) {
      options.push(
        <option key={prime.name} value={prime.name}>{prime.name}</option>
      );
      // When we encounter the prime corresponding to the selected name,
      // save off the full object
      if (this.state.name === prime.name) {
        text = prime;
      }
    }

    text = JSON.stringify(text, null, 2);

    return (
      <div className="prime-editor">
        <select
          id="prime-selector"
          className="prime-select"
          value={this.state.name}
          onChange={this.handleNameChange}
        >
          {options}
        </select>
        <textarea
          id="prime-text"
          className="prime-text"
          value={this.state.text===undefined ? text : this.state.text}
          onChange={this.handleTextChange} />
      </div>
    );
  }
}

export {
  PrimeEditor,
};
