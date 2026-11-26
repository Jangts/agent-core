/**
 * Re-export barrel: the native-function-call model interaction adapter.
 *
 * Applications reference it through the Support interaction catalog; the implementation lives in
 * the Core model layer and is not duplicated here.
 */
export { nativeFunctionInteraction } from '../../../model/interactions/native-functions.js';
