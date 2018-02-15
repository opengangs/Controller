/**
 * @author elukashick
 */

import HWInfoManager from '../managers/HWInfoManager';
import USBInfoManager from '../managers/usbInfoManager';
import AppUtils from "../utils/appUtils";

const saveHWInfo = function (props, params, callback) {

    let info = AppUtils.getProperty(params, props.fogInfo),
        uuid = AppUtils.getProperty(params, props.uuid);

    let config = {
        info: info,
        iofog_uuid: uuid
    };

    HWInfoManager
        .saveInfo(config)
        .then(AppUtils.onCreate.bind(null, params, props.setProperty, 'Unable to save HW Info.', callback));
};

const saveUSBInfo = function (props, params, callback) {

    let info = AppUtils.getProperty(params, props.fogInfo),
        uuid = AppUtils.getProperty(params, props.uuid);

    let config = {
        info: info,
        iofog_uuid: uuid
    };

    USBInfoManager
        .upsert(config)
        .then(AppUtils.onCreate.bind(null, params, props.setProperty, 'Unable to save USB Info.', callback));
};

export default {
    saveHWInfo: saveHWInfo,
    saveUSBInfo: saveUSBInfo,
};