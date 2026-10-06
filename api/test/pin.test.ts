// 1. Imports. Vitest gives us describe / it / expect.
//    "../src/auth/pin.js" ends in .js even though the file is pin.ts: that is how Node's ESM
//    resolution works with TypeScript. You always import the .js name.
import { describe, expect, it } from 'vitest';
import { isWeakPin } from '../src/auth/pin.js';

// 2. describe() groups related tests under one name. Its text shows up in the test report.
describe('isWeakPin (FR-AUTH-09)', () => {
  // 3. it() is ONE test case. The text should read as a sentence: "it rejects a PIN made of one repeated digit".
  it('rejects a PIN made of one repeated digit', () => {
    // 4. Arrange / Act / Assert: set up the input, call the code, check the result.
    const pin = '1111';                  // Arrange
    const result = isWeakPin(pin);      // Act
    expect(result).toBe(true);          // Assert: toBe() compares with ===
  });
});
