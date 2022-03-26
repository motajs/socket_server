// @ts-check

/**
 * 
 * @param {string | number} x 
 * @returns 
 */
export function setTwoDigits(x) {
    if (typeof x === "number") x = x.toString();
    return x.padStart(2, "0");
}

/**
 * 
 * @param {number} time 
 * @returns 
 */
export function formatTime(time) {
    time /= 1000;
    return setTwoDigits(~~(time / 60)) + ":" + setTwoDigits(~~(time % 60));
}
