// The timer has three states, given by the class on body:
//           -- start ->         -- pause ->
//   Stopped             running             paused
//           <- stop ---         <- resume -
// The state transitions are effeted but the <verb>timer methods.
//
// The current direction is controlled by the id on body.
//
// CSS is used for many things, e.g. ensuring that only the
// buttons for the currently relevant state transitions are
// available, and flipping the image.

'use strict';

// Get the audioContext we will use for sound playing in a cross-platform way.
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();

let mu, // The parameter mu from the definition of the GPD.
    xi, // The parameter xi from the definition of the GPD.
    sigma, // The parameter xi from the definition of the GPD.
    currentDuration, // The time until the timer should stop, when we are paused.
    nextEndTime = null, // The time that time will next expire (milliseconds epoch). Null if the timer is stopped.
    timer, // Handle for the setTimeout for when the timer next expires.
    pigSound = null; // Audio element holding the pig noise (once loaded).

/**
 * Round a number to the nearest 0.1.
 *
 * @param x {number} number to round.
 * @returns {number} rounded value.
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
    let button = e.target;
    if (!button.matches('button')) {
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
    if (document.body.className === 'stopped' || document.body.className === 'paused') {
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
    container.addEventListener('click', buttonClicked);
    document.getElementById('timer').addEventListener('click', timerClicked);
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
 * Start the timer, and display the times.
 */
function startTimer() {
    document.body.className = 'running';
    currentDuration = 60000 * getValueFromDistribution(); // Milliseconds.
    timer = setTimeout(timeFinished, currentDuration);
    nextEndTime = Date.now() + currentDuration;
    displayDuration('totaltime', currentDuration);
    document.getElementById('previous').insertAdjacentText('beforeend',
        ' ' + formatDuration(currentDuration) + ',');
}

/**
 * Stop the timer.
 */
function stopTimer() {
    document.body.className = 'stopped';
    clearTimeout(timer);
    timer = null;
    nextEndTime = null;
    displayDuration('totaltime', null);
}

/**
 * Pause the timer.
 */
function pauseTimer() {
    document.body.className = 'paused';
    clearTimeout(timer);
    timer = null;
    currentDuration = nextEndTime - Date.now();
}

/**
 * Resume the timer.
 */
function resumeTimer() {
    document.body.className = 'running';
    timer = setTimeout(timeFinished, currentDuration);
    nextEndTime = Date.now() + currentDuration;
}

/**
 * Update the count-down display. Called periodically.
 */
function updateTimer() {
    if (document.body.className === 'paused') {
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
    if (document.body.id.includes('anti')) {
        document.body.id = 'going-clockwise';
    } else {
        document.body.id = 'going-anticlockwise';
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
