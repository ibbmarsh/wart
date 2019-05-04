import React from 'react';

import {
  findOwnedByName,
  rarityToLevel,
} from './helpers.js';

class RewardRow extends React.Component {
  constructor(props) {
    super(props);
    this.handleRewardClick = this.handleRewardClick.bind(this);
  }

  handleRewardClick(e) {
    // Add the reward to our inventory.
    this.props.onCountChange("part",
      this.props.reward.name,
      this.props.reward.uid,
      this.props.reward.ownedCount+1
    );
    // Reset the code dropdowns.
    this.props.onCodeChange(0,"None");
    this.props.onCodeChange(1,"None");
    this.props.onCodeChange(2,"None");
    this.props.onCodeChange(3,"None");
    // Finally, set input focus to the first code box.
    this.props.resetCodeFocus();
  }

  render() {
    return (
      <li
        className={"reward rarity-"+this.props.reward.rarity}
        onClick={this.handleRewardClick}
      >
        <span className={"reward-name"}>
          {this.props.reward.name}
        </span>
        <span className="reward-ducats">
          {this.props.reward.ducats} ducats
        </span>
      </li>
    );
  }
}

/*
 * The main part of this page. Five dropdowns (era and 4 codes).
 * When the era is selected and at least one of the 4 codes has a valid value,
 * a prioritized list of rewards displays below the dropdowns.
 */
class RelicRunner extends React.Component {
  constructor(props) {
    super(props);
    this.handleEraChange = this.handleEraChange.bind(this);
    this.handleCodeChange = this.handleCodeChange.bind(this);
    this.resetCodeFocus = this.resetCodeFocus.bind(this);
    this.rewardsListSorter = this.rewardsListSorter.bind(this);
  }

  handleEraChange(e) {
    this.props.onEraChange(e.target.value);
  }

  handleCodeChange(e) {
    const index = e.target.dataset.index;
    const value = e.target.value;
    this.props.onCodeChange(index, value);
  }

  resetCodeFocus() {
    this.codeInputs[0].focus();
  }

  rewardsListSorter(r1, r2) {
    // Top sort level is desireLevel (reverse numerical).
    if (r1.desireLevel < r2.desireLevel) return 1;
    if (r1.desireLevel > r2.desireLevel) return -1;
    // Second sort level is ducats (reverse numerical).
    if (r1.ducats < r2.ducats) return 1;
    if (r1.ducats > r2.ducats) return -1;
    // Alphabetical after that.
    if (r1.name < r2.name) return -1;
    if (r1.name > r2.name) return 1;
    // We should never get here, so we don't care.
    return 0;
  }

  addDesireDescription(prioritizedList, desireLevel) {
    if (desireLevel === 2) {
      prioritizedList.push(
        <li
          key="desire-description-desired"
          id="desire-description-desired"
          className="desire-description"
        >
          Desired prime missing parts
        </li>
      );
    } else if (desireLevel === 1) {
      prioritizedList.push(
        <li
          key="desire-description-complete"
          id="desire-description-complete"
          className="desire-description"
        >
          Unowned prime missing parts
        </li>
      );
    } else {
      prioritizedList.push(
        <li
          key="desire-description-unneeded"
          id="desire-description-unneeded"
          className="desire-description"
        >
          Unneeded parts
        </li>
      );
    }
  }

  render() {
    // The era list is static... for now.
    const eraOptions = [
      <option key="None" value="None">None</option>,
      <option key="Lith" value="Lith">Lith</option>,
      <option key="Meso" value="Meso">Meso</option>,
      <option key="Neo" value="Neo">Neo</option>,
      <option key="Axi" value="Axi">Axi</option>
    ];

    // But we need to build the code list each time.
    let codeOptions = [
      <option key="None" value="None">None</option>
    ];
    if (this.props.era !== "None") {
      for (const relic of this.props.relics) {
        if (relic.era === this.props.era) {
          codeOptions.push(
            <option key={relic.code} value={relic.code}>{relic.code}
              {relic.vaulted ? " (V)" : ""}
            </option>
          );
        }
      }
    }
    let codeSelects = [];
    this.codeInputs = [];
    for (const i in this.props.codes) {
      codeSelects.push(
        <select
          id={"code-select-"+i}
          key={"code-select-"+i}
          className="code-select"
          value={this.props.codes[i]}
          onChange={this.handleCodeChange}
          data-index={i}
          ref={(input) => {this.codeInputs[i] = input}}
        >
          {codeOptions}
        </select>
      );
    }

    // Now the reason I started this whole project:
    // *** Prioritized list of rewards based on which primes I don't own! ***
    let prioritizedList = []
    if ( this.props.codes[0] !== "None"
      || this.props.codes[1] !== "None"
      || this.props.codes[2] !== "None"
      || this.props.codes[3] !== "None")
    {
      // First build a list of the rewards with keys for sorting.
      let selectedRelics = [];
      for (const code of this.props.codes) {
        if (code !== "None") {
          selectedRelics.push(this.props.era+" "+code);
        }
      }
      let rewardsNameList = [];
      let rewardsList = [];
      for (const relic of this.props.relics) {
        if (selectedRelics.indexOf(relic.name) !== -1) {
          for (const reward of relic.rewards) {
            // Only add each reward name once. This will very rarely
            // result in odd situations where my program says the rarity
            // is uncommon, but the end-of-mission screen shows it as
            // common (or similar). It's rare enough that I don't care.
            if (rewardsNameList.indexOf(reward.name) === -1) {
              rewardsNameList.push(reward.name);
              let partData = this.props.partsData[reward.name];
              let desireLevel = (
                partData.neededForDesire ? 2 : (
                  partData.neededForComplete ? 1 : 0
              ));
              rewardsList.push({
                "name": reward.name,
                "uid": reward.uid,
                "rarity": reward.rarity,
                "rarityLevel": rarityToLevel(reward.rarity),
                "ducats": partData.ducats,
                "desireLevel": desireLevel,
                "ownedCount": partData.ownedCount,
              });
            }
          }
        }
      }
      // That was a mouthful. Now sort this rewardsList using the keys.
      rewardsList.sort(this.rewardsListSorter);

      // Time to put all the HTML tags in.
      let prevDesireLevel = 999;
      for (const reward of rewardsList) {
        if (reward.desireLevel !== prevDesireLevel) {
          prevDesireLevel = reward.desireLevel;
          this.addDesireDescription(prioritizedList, reward.desireLevel);
        }
        prioritizedList.push(
          <RewardRow
            key={reward.name}
            reward={reward}
            onCountChange={this.props.onCountChange}
            onCodeChange={this.props.onCodeChange}
            resetCodeFocus={this.resetCodeFocus}
          />
        );
      }
    }

    return (
      <div className="relic-runner">
        <div className="era-select-wrapper">
          <label htmlFor="era-select">Era:</label>
          <select
            id="era-select"
            className="era-select"
            value={this.props.era}
            onChange={this.handleEraChange}
          >
            {eraOptions}
          </select>
        </div>
        <div className="code-select-wrapper">
          <label htmlFor="code-select-0">Code:</label>
          {codeSelects}
        </div>
        <ol className="rewards-list">
          <div className="rewards-description">
            {
              (prioritizedList.length > 0)
                ? "Below is a prioritized list of the rewards from the selected relics. Once you have chosen your reward in the game, click that same reward here to add it to your inventory and update calculations."
                : ""
            }
          </div>
          {prioritizedList}
        </ol>
      </div>
    );
  }
}

/*
 * This component is a simple list of specific relics, with a description
 * at the top.
 */
class RelicList extends React.Component {
  constructor(props) {
    super(props);

    this.handleRelicClicked = this.handleRelicClicked.bind(this);
  }

  handleRelicClicked(e) {
    const era = e.target.dataset.era;
    const code = e.target.dataset.code;
    this.props.onRelicChange(era, code);
    document.getElementById("code-select-1").focus();
  }

  render() {
    let relics = [];
    for (const relic of this.props.relics) {
      if (this.props.era === "None" || this.props.era === relic.era) {
        relics.push(
          <li
            key={relic.name}
            data-era={relic.era}
            data-code={relic.code}
            onClick={this.handleRelicClicked}
          >
            {relic.name}
            {relic.vaulted ? " (V)" : ""}
          </li>
        );
      }
    }
    return (
      <div className="relic-list">
        <div className="description">
          {this.props.description}
        </div>
        <ul>
          {relics}
        </ul>
      </div>
    );
  }
}

class RelicRun extends React.Component {
  constructor(props) {
    super(props);
    // We keep the chosen era/codes at this level so we can pass them
    // between the children.
    this.state = {
      "era": "None",
      "codes": ["None","None","None","None"],
    }

    this.onEraChange = this.onEraChange.bind(this);
    this.onCodeChange = this.onCodeChange.bind(this);
    this.onRelicChange = this.onRelicChange.bind(this);
  }

  onEraChange(newEra) {
    // We need to reset the codes whenever the era is changed.
    let newState = Object.assign({}, this.state, {
      "era": newEra,
      "codes": ["None","None","None","None"],
    });
    this.setState(newState);
  }

  onCodeChange(index, newCode) {
    let newState = Object.assign({}, this.state);
    newState.codes[index] = newCode;
    this.setState(newState);
  }

  onRelicChange(newEra, newCode) {
    let newState = Object.assign({}, this.state, {
      "era": newEra,
      "codes": [newCode,"None","None","None"],
    });
    this.setState(newState);
  }

  render() {
    // First step is to build a dictionary with prime part name keys
    // and needed dict values.
    // This will allow quick lookup when we finally get to the runner.
    let partsData = {};
    for (const prime of this.props.primes) {
      let primeOwned = findOwnedByName(prime.name, this.props.primesInventory);
      let primeDesired = findOwnedByName(prime.name, this.props.desired);
      for (const component of prime.components) {
        let partOwned =
          findOwnedByName(component.name, this.props.partsInventory);
        let neededForDesire = (primeDesired && component.needed > partOwned);
        let neededForComplete = (!primeOwned && component.needed > partOwned);
        partsData[component.name] = {
          "neededForDesire": neededForDesire,
          "neededForComplete": neededForComplete,
          "ownedCount": partOwned,
          "ducats": component.ducats,
        };
      }
    }

    // Next up is building the lists of relics which can be safely run.
    let relicsNoneNeeded = [];
    let relicsCommonNeeded = [];
    let relicsRarerNeeded = [];
    for (const relic of this.props.relics) {
      let rarityLevelNeeded = 0;
      for (const reward of relic.rewards) {
        if (!(reward.name in partsData)) {
          continue;
        }
        let partData = partsData[reward.name];
        if ((partData.neededForDesire || partData.neededForComplete)
          && rarityToLevel(reward.rarity) > rarityLevelNeeded)
        {
          rarityLevelNeeded = rarityToLevel(reward.rarity);
        }
      }
      if (rarityLevelNeeded >= 2) {
        relicsRarerNeeded.push(relic);
      } else if (rarityLevelNeeded >= 1) {
        relicsCommonNeeded.push(relic);
      } else {
        relicsNoneNeeded.push(relic);
      }
    }

    return (
      <div className="relicrun-panes">
        <RelicRunner
          relics={this.props.relics}
          era={this.state.era}
          codes={this.state.codes}
          partsData={partsData}
          onEraChange={this.onEraChange}
          onCodeChange={this.onCodeChange}
          onCountChange={this.props.onCountChange}
        />
        <RelicList
          relics={relicsNoneNeeded}
          description={
            "You do not need any of the rewards from these relics."
            + " Click a relic to populate the era and first code in the"
            + " runner."
          }
          era={this.state.era}
          onRelicChange={this.onRelicChange}
        />
        <RelicList
          relics={relicsCommonNeeded}
          description="You only need the common rewards from these relics."
          era={this.state.era}
          onRelicChange={this.onRelicChange}
        />
        <RelicList
          relics={relicsRarerNeeded}
          description="You need uncommon or rare rewards from these relics."
          era={this.state.era}
          onRelicChange={this.onRelicChange}
        />
      </div>
    );
  }
}

export {
  RelicRun,
};
