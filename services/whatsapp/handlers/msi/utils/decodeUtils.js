const { decodeGS1 } = require('../../../handlers/handleDecodifica'); 

module.exports = {
    decodeImage: async(base64) => {
        try {
            return await decodeGS1(base64);
        } catch (e) {
            return null;
        }
    }
};
