import ChangeTrackingManager from '../managers/changeTrackingManager';
import AppUtils from '../utils/appUtils'

/**
 * @desc - this function finds the element instance which was changed
 */
const initiateFabricChangeTracking = function(params, callback) {
  ChangeTrackingManager
    .createChangeTracking(params.fabricInstance.uuid)
    .then(AppUtils.onCreate.bind(null, params, null, 'Unable to initialize change tracking for Fabric Instance', callback));

}

const updateChangeTracking = function(props, params, callback) {
  var fogInstanceId = AppUtils.getProperty(params, props.fogInstanceId);

  ChangeTrackingManager
    .updateByUuid(fogInstanceId, props.changeObject)
    .then(AppUtils.onUpdate.bind(null, params, 'Unable to update Change Tracking', callback));

}

const updateConfigTracking = function(params, callback) {
  if (params.isConfigChanged) {
    var updateChange = {
      containerConfig: new Date().getTime()
    };

    ChangeTrackingManager
      .updateByUuid(params.elementInstance.iofabric_uuid, updateChange)
      .then(AppUtils.onUpdate.bind(null, params, 'Unable to update Change Tracking for Fog instance', callback));
  } else {
    callback(null, params);
  }
}

const deleteChangeTracking  = function(props, params, callback) {
  var instanceId = AppUtils.getProperty(params, props.instanceId);
  
  ChangeTrackingManager
    .deleteByInstanceId(instanceId)
    .then(AppUtils.onDelete.bind(null, params, 'Unable to delete Change Tracking', callback));
}



export default {
  initiateFabricChangeTracking: initiateFabricChangeTracking,
  updateChangeTracking: updateChangeTracking,
  updateConfigTracking: updateConfigTracking,
  deleteChangeTracking: deleteChangeTracking
};