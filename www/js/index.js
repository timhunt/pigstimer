/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// The timer has three states, given by a class on #outer:
//           -- start ->         -- pause ->
//   stopped             running             paused
//           <- stop ---         <- resume -
// The state transitions are effeted but the <verb>timer methods.
//
// The current direction is controlled by a class
// going-anticlockwise / going-clockwise on #outer.
//
// CSS is used for many things, e.g. ensuring that only the
// buttons for the currently relevant state transitions are
// available, and flipping the image.

'use strict';

/** Constructor */
function PigsTimer() {
// Get the audioContext we will use for sound playing in a cross-platform way.
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();

    let mu, // The parameter mu from the definition of the GPD.
        xi, // The parameter xi from the definition of the GPD.
        sigma, // The parameter xi from the definition of the GPD.
        currentDuration, // The time until the timer should stop, when we are paused.
        nextEndTime = null, // The time that time will next expire (milliseconds epoch). Null if the timer is stopped.
        timer, // Handle for the setTimeout for when the timer next expires.
        pigSound = null, // Audio element holding the pig noise (once loaded).
        outerDiv = document.getElementById('outer');

    /**
     * Round a number to the nearest 0.1.
     *
     * @param {Number} x number to round.
     * @returns {Number} rounded value.
     */
    function roundToTenth(x) {
        return Math.round(10 * x) / 10;
    }

    /**
     * Called when the parameters have been altered to new valid values.
     */
    function parametersChanged() {
        let minEl = document.getElementById('min'),
            meanEl = document.getElementById('mean'),
            maxEl = document.getElementById('max'),
            min = roundToTenth(minEl.value),
            mean = roundToTenth(meanEl.value),
            max = roundToTenth(maxEl.value);

        minEl.value = min;
        minEl.dataset.lastGoodValue = min;
        meanEl.value = mean;
        meanEl.dataset.lastGoodValue = mean;
        maxEl.value = max;
        maxEl.dataset.lastGoodValue = max;

        minEl.max = mean - 0.1;
        meanEl.min = min + 0.1;
        meanEl.max = max - 0.1;
        maxEl.min = mean + 0.1;

        mu = min;
        xi = -(mean - min) / (max - mean);
        sigma = -xi * (max - min);

        document.getElementById('mu').innerText = mu;
        document.getElementById('sigma').innerText = sigma;
        document.getElementById('xi').innerText = xi;
    }

    /**
     * Handles focus events.
     *
     * If the event is on one of our inputs, store the last good value.
     *
     * @param e {Event} the event being handled.
     */
    function editingStarted(e) {
        let input = e.target;
        if (!input.matches('input')) {
            return;
        }
        input.select();
    }

    /**
     * Handles blur or change events.
     *
     * If the event is on one of our inputs, update the distribution parameters,
     * else revert to last good value.
     *
     * @param e {Event} the event being handled.
     */
    function editingFinished(e) {
        let input = e.target;
        if (!input.matches('input')) {
            return;
        }
        if (input.validity.valid) {
            parametersChanged();
        } else {
            input.value = input.dataset.lastGoodValue;
        }
    }

    /**
     * Handle key events.
     *
     * If the key pressed was Esc, and if we are editing one of our inputs, revert to last good value.
     *
     * @param e {KeyboardEvent} the event being handled.
     */
    function editingCancelled(e) {
        if (e.key !== 'Escape') {
            return;
        }
        let input = e.target;
        if (!input.matches('input')) {
            return;
        }
        input.value = input.dataset.lastGoodValue;
        input.blur();
    }

    /**
     * Handle when one of the buttons is clicked.
     *
     * @param e {Event} the event being handled.
     */
    function buttonClicked(e) {
        let button = e.target.closest('button');
        if (!button) {
            return;
        }
        switch (button.id) {
            case 'stop':
                stopTimer();
                break;

            case 'start':
                startTimer();
                break;

            case 'pause':
                pauseTimer();
                break;

            case 'resume':
                resumeTimer();
                break;
        }
    }

    /**
     * Handle when one the timer is clicked.
     *
     * Reverse direction, if stopped or paused.
     *
     * @param e {Event} the event being handled.
     */
    function timerClicked(e) {
        if (isRunningState('stopped') || isRunningState('paused')) {
            reverseDirection();
        }
    }

    /**
     * Initialise the event handlers on the UI.
     */
    function setupEventHandlers() {
        let container = document.getElementById('settings');
        container.addEventListener('focusin', editingStarted);
        container.addEventListener('focusout', editingFinished);
        container.addEventListener('change', editingFinished);
        container.addEventListener('keypress', editingCancelled);
        document.getElementById('buttons').addEventListener('click', buttonClicked);
        document.getElementById('image').addEventListener('click', timerClicked);
    }

    /**
     * Get a random value distributed according to the Generalized Pareto distribution.
     *
     * See https://en.wikipedia.org/wiki/Generalized_Pareto_distribution.
     * The parameters used are the global variables above.
     *
     * @returns {number} a value from the distribution.
     */
    function getValueFromDistribution() {
        return mu + sigma * (Math.random()**(-xi) - 1) / xi;
    }

    /**
     * Convert a number to a string with at least two digits.
     *
     * @param num {number} the number to display.
     * @returns {string} formatted number.
     */
    function twoDigit (num) {
        if (num < 10) {
            return '0' + num;
        } else {
            return '' + num;
        }
    }

    /**
     * Convert a duration in milliseconds to a string 'MM:SS'.
     *
     * @param milliseconds {number} duration in milliseconds.
     * @returns {string} formatted display.
     */
    function formatDuration(milliseconds) {
        let seconds = Math.floor(milliseconds / 1000);
        return twoDigit(Math.floor(seconds / 60)) + ':' + twoDigit(seconds % 60);
    }

    /**
     * Display a duration in millisecond in the HTML element with given id.
     *
     * @param elementId id of the element where the duration should be displayed.
     * @param milliseconds {Number?} time to display, or null if none.
     */
    function displayDuration(elementId, milliseconds) {
        let element = document.getElementById(elementId);
        if (milliseconds === null) {
            element.innerText = '-';
        }
        element.innerText = formatDuration(milliseconds);
    }

    /**
     * Set the running state of the timer.
     *
     * @param {String} state the state to set. 'paused', 'stopped' or 'running'.
     */
    function setRunningState(state) {
        outerDiv.classList.remove('paused');
        outerDiv.classList.remove('stopped');
        outerDiv.classList.remove('running');
        outerDiv.classList.add(state);
    }

    /**
     * Test if the current state is a particular value.
     *
     * @param {String} state the state to test. 'paused', 'stopped' or 'running'.
     * @return {boolean} true if we are in this state.
     */
    function isRunningState(state) {
        return outerDiv.classList.contains(state);
    }

    /**
     * Start the timer, and display the times.
     */
    function startTimer() {
        setRunningState('running');
        currentDuration = 60000 * getValueFromDistribution(); // Milliseconds.
        timer = setTimeout(timeFinished, currentDuration);
        nextEndTime = Date.now() + currentDuration;
        displayDuration('totaltime', currentDuration);
        document.getElementById('previous').insertAdjacentText('beforeend',
            ' ' + formatDuration(currentDuration) + ',');
        window.plugins.insomnia.keepAwake()
    }

    /**
     * Stop the timer.
     */
    function stopTimer() {
        setRunningState('stopped');
        clearTimeout(timer);
        timer = null;
        nextEndTime = null;
        displayDuration('totaltime', null);
        window.plugins.insomnia.allowSleepAgain()
    }

    /**
     * Pause the timer.
     */
    function pauseTimer() {
        setRunningState('paused');
        clearTimeout(timer);
        timer = null;
        currentDuration = nextEndTime - Date.now();
        window.plugins.insomnia.allowSleepAgain()
    }

    /**
     * Resume the timer.
     */
    function resumeTimer() {
        setRunningState('running');
        timer = setTimeout(timeFinished, currentDuration);
        nextEndTime = Date.now() + currentDuration;
        window.plugins.insomnia.keepAwake()
    }

    /**
     * Update the count-down display. Called periodically.
     */
    function updateTimer() {
        if (isRunningState('paused')) {
            return;
        }
        if (nextEndTime === null) {
            displayDuration('timeleft', null);
        } else {
            displayDuration('timeleft', Math.max(nextEndTime - Date.now(), 0));
        }
    }

    /**
     * Called when the current time expires.
     *
     * Reverses the direction and starts the timer again.
     */
    function timeFinished() {
        playPigSound();
        reverseDirection();
        startTimer();
    }

    /**
     * Reverse the direction.
     */
    function reverseDirection() {
        if (outerDiv.classList.contains('going-clockwise')) {
            outerDiv.classList.remove('going-clockwise');
            outerDiv.classList.add('going-anticlockwise');
        } else {
            outerDiv.classList.remove('going-anticlockwise');
            outerDiv.classList.add('going-clockwise');
        }
    }

    /**
     * Load the pig sound audio file into an AudioBuffer.
     */
    function loadPigSound() {
        pigSound = document.querySelector('audio');
        const source = audioContext.createMediaElementSource(pigSound);
        source.connect(audioContext.destination);
    }


    /**
     * Play the pig sound.
     */
    function playPigSound() {
        pigSound.cloneNode().play().then(() => {
            document.getElementById('warning').className = 'hidden';
        }).catch(error => {
            // Auto-play was prevented
            document.getElementById('details').innerText = error;
            document.getElementById('warning').className = '';
        });
    }

    // Initialise everything.
    parametersChanged();
    setInterval(updateTimer, 100);
    loadPigSound();
    setupEventHandlers();
}

document.addEventListener('deviceready', () => { new PigsTimer(); });
