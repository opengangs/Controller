/*
 * *******************************************************************************
 *  * Copyright (c) 2018 Edgeworx, Inc.
 *  *
 *  * This program and the accompanying materials are made available under the
 *  * terms of the Eclipse Public License v. 2.0 which is available at
 *  * http://www.eclipse.org/legal/epl-2.0
 *  *
 *  * SPDX-License-Identifier: EPL-2.0
 *  *******************************************************************************
 *
 */

const TransactionDecorator = require('../decorators/transaction-decorator');

const FogProvisionKeyManager = require('../sequelize/managers/iofog-provision-key-manager');
const FogTypeManager = require('../sequelize/managers/iofog-type-manager');
const FogManager = require('../sequelize/managers/iofog-manager');
const FogAccessTokenService = require('../services/iofog-access-token-service');
const ChangeTrackingManager = require('../sequelize/managers/change-tracking-manager');
const FogVersionCommandManager = require('../sequelize/managers/iofog-version-command-manager');
const StraceManager = require('../sequelize/managers/strace-manager');
const RegistryManager = require('../sequelize/managers/registry-manager');
const Validator = require('../schemas');
const Errors = require('../helpers/errors');
const AppHelper = require('../helpers/app-helper');
const ErrorMessages = require('../helpers/error-messages');
const HWInfoManager = require('../sequelize/managers/hw-info-manager');
const USBInfoManager = require('../sequelize/managers/usb-info-manager');
const TunnelManager = require('../sequelize/managers/tunnel-manager');
const MicroserviceManager = require('../sequelize/managers/microservice-manager');
const MicroserviceService = require('../services/microservices-service');
const path = require('path');
const fs = require('fs');
const formidable = require('formidable');
const logger = require('../logger');
const Sequelize = require('sequelize');
const Op = Sequelize.Op

const agentProvision = async function (provisionData, transaction) {

  await Validator.validate(provisionData, Validator.schemas.agentProvision);

  const provision = await FogProvisionKeyManager.findOne({
    provisionKey: provisionData.key
  }, transaction);
  if (!provision) {
    throw new Errors.NotFoundError(ErrorMessages.INVALID_PROVISIONING_KEY)
  }

  let currentTime = new Date();
  if (provision.expirationTime < currentTime) {
    throw new Errors.AuthenticationError(ErrorMessages.EXPIRED_PROVISION_KEY)
  }

  const fog = await FogManager.findOne({
    uuid: provision.iofogUuid
  }, transaction);

  await _checkMicroservicesFogType(fog, provisionData.type, transaction);

  const newAccessToken = await FogAccessTokenService.generateAccessToken(transaction);

  await FogAccessTokenService.updateAccessToken(fog.uuid, newAccessToken, transaction);

  await FogManager.update({
    uuid: fog.uuid
  }, {
    fogTypeId: provisionData.type
  }, transaction);

  await FogProvisionKeyManager.delete({
    provisionKey: provisionData.key
  }, transaction);

  return {
    uuid: fog.uuid,
    token: newAccessToken.token
  };

};

const getAgentConfig = async function (fog) {
  return {
    networkInterface: fog.networkInterface,
    dockerUrl: fog.dockerUrl,
    diskLimit: fog.diskLimit,
    diskDirectory: fog.diskDirectory,
    memoryLimit: fog.memoryLimit,
    cpuLimit: fog.cpuLimit,
    logLimit: fog.logLimit,
    logDirectory: fog.logDirectory,
    logFileCount: fog.logFileCount,
    statusFrequency: fog.statusFrequency,
    changeFrequency: fog.changeFrequency,
    deviceScanFrequency: fog.deviceScanFrequency,
    watchdogEnabled: fog.watchdogEnabled,
    latitude: fog.latitude,
    longitude: fog.longitude
  };
};

const updateAgentConfig = async function (updateData, fog, transaction) {
  await Validator.validate(updateData, Validator.schemas.updateAgentConfig);

  let update = {
    networkInterface: updateData.networkInterface,
    dockerUrl: updateData.dockerUrl,
    diskLimit: updateData.diskLimit,
    diskDirectory: updateData.diskDirectory,
    memoryLimit: updateData.memoryLimit,
    cpuLimit: updateData.cpuLimit,
    logLimit: updateData.logLimit,
    logDirectory: updateData.logDirectory,
    logFileCount: updateData.logFileCount,
    statusFrequency: updateData.statusFrequency,
    changeFrequency: updateData.changeFrequency,
    deviceScanFrequency: updateData.deviceScanFrequency,
    watchdogEnabled: updateData.watchdogEnabled,
    latitude: updateData.latitude,
    longitude: updateData.longitude,
    gpsMode: updateData.gpsMode
  };
  update = AppHelper.deleteUndefinedFields(update);

  await FogManager.update({
    uuid: fog.uuid
  }, update, transaction);
};

const getAgentConfigChanges = async function (fog, transaction) {

  const changeTracking = await ChangeTrackingManager.findOne({
    iofogUuid: fog.uuid
  }, transaction);
  if (!changeTracking) {
    throw new Errors.NotFoundError(ErrorMessages.INVALID_NODE_ID)
  }

  const cleanTracking = {
    config: false,
    version: false,
    reboot: false,
    deleteNode: false,
    containerList: false,
    containerConfig: false,
    routing: false,
    registries: false,
    proxy: false,
    diagnostics: false,
    isImageSnapshot: false
  };

  await ChangeTrackingManager.update({
    iofogUuid: fog.uuid
  }, cleanTracking, transaction);


  return {
    config: changeTracking.config,
    version: changeTracking.version,
    reboot: changeTracking.reboot,
    deleteNode: changeTracking.deleteNode,
    microserviceList: changeTracking.containerList,
    microserviceConfig: changeTracking.containerConfig,
    routing: changeTracking.routing,
    registries: changeTracking.registries,
    tunnel: changeTracking.proxy,
    diagnostics: changeTracking.diagnostics,
    isImageSnapshot: changeTracking.isImageSnapshot
  };
};

const updateAgentStatus = async function (agentStatus, fog, transaction) {
  await Validator.validate(agentStatus, Validator.schemas.updateAgentStatus);

  let update = {
    daemonStatus: agentStatus.daemonStatus,
    daemonOperatingDuration: agentStatus.daemonOperatingDuration,
    daemonLastStart: agentStatus.daemonLastStart,
    memoryUsage: agentStatus.memoryUsage,
    diskUsage: agentStatus.diskUsage,
    cpuUsage: agentStatus.cpuUsage,
    memoryViolation: agentStatus.memoryViolation,
    diskViolation: agentStatus.diskViolation,
    cpuViolation: agentStatus.cpuViolation,
    microserviceStatus: agentStatus.microserviceStatus,
    repositoryCount: agentStatus.repositoryCount,
    repositoryStatus: agentStatus.repositoryStatus,
    systemTime: agentStatus.systemTime,
    lastStatusTime: agentStatus.lastStatusTime,
    ipAddress: agentStatus.ipAddress,
    processedMessages: agentStatus.processedMessages,
    microserviceMessageCounts: agentStatus.microserviceMessageCounts,
    messageSpeed: agentStatus.messageSpeed,
    lastCommandTime: agentStatus.lastCommandTime,
    tunnelStatus: agentStatus.tunnelStatus,
    version: agentStatus.version,
    isReadyToUpgrade: agentStatus.isReadyToUpgrade,
    isReadyToRollback: agentStatus.isReadyToRollback
  };
  update = AppHelper.deleteUndefinedFields(update);

  await FogManager.update({
    uuid: fog.uuid
  }, update, transaction);
};

const getAgentMicroservices = async function (fog, transaction) {
  const microservices = await MicroserviceManager.findAllWithDependencies({
    iofogUuid: fog.uuid
  }, {}, transaction);

  const fogTypeId = fog.fogTypeId;

  const response = [];
  for (const microservice of microservices) {
    let imageId = '';
    const images = microservice.catalogItem.images;
    for (const image of images) {
      if (image.fogTypeId === fogTypeId) {
        imageId = image.containerImage;
        break;
      }
    }

    const registry = await RegistryManager.findOne({
      id: microservice.catalogItem.registryId
    }, transaction);

    const registryUrl = registry.url;

    const routes = await MicroserviceService.getPhysicalConections(microservice, transaction);

    const responseMicroservice = {
      uuid: microservice.uuid,
      imageId: imageId,
      needUpdate: microservice.needUpdate,
      config: microservice.config,
      rebuild: microservice.rebuild,
      rootHostAccess: microservice.rootHostAccess,
      logSize: microservice.logSize,
      registryUrl: registryUrl,
      portMappings: microservice.ports,
      volumeMappings: microservice.volumeMappings,
      imageSnapshot: microservice.imageSnapshot,
      deleteWithCleanUp: microservice.deleteWithCleanUp,
      routes: routes
    };

    response.push(responseMicroservice);
  }

  return {
    microservices: response
  }
};

const getAgentMicroservice = async function (microserviceId, fog, transaction) {
  const microservice = await MicroserviceManager.findOneWithDependencies({
    uuid: microserviceId,
    iofogUuid: fog.uuid
  }, {}, transaction);
  return {
    microservice: microservice
  }
};

const getAgentRegistries = async function (fog, transaction) {
  const registries = await RegistryManager.findAll({
    [Op.or]:
      [
        {
          userId: fog.userId
        },
        {
          isPublic: true
        }
      ]
  }, transaction);
  return {
    registries: registries
  }
};

const getAgentProxy = async function (fog, transaction) {
  const proxy = TunnelManager.findOne({
    iofogUuid: fog.uuid
  }, transaction);
  return {
    proxy: proxy
  }
};

const getAgentStrace = async function (fog, transaction) {
  const fogWithDependencies = FogManager.findFogStraces({
    uuid: fog.uuid
  }, transaction);
  return fogWithDependencies.strace;
};

const updateAgentStrace = async function (straceData, fog, transaction) {
  await Validator.validate(straceData, Validator.schemas.updateAgentStrace);

  for (const strace of straceData.straceData) {
    const microserviceId = strace.microserviceId;
    const buffer = strace.buffer;
    await StraceManager.pushBufferByMicroserviceId(microserviceId, buffer, transaction)
  }

};

const getAgentChangeVersionCommand = async function (fog, transaction) {
  const versionCommand = await FogVersionCommandManager.findOne({
    iofogUuid: fog.uuid
  }, transaction);
  if (!versionCommand) {
    throw new Errors.NotFoundError(ErrorMessages.VERSION_COMMAND_NOT_FOUND);
  }

  const provision = FogProvisionKeyManager.findOne({
    iofogUuid: fog.uuid
  }, transaction);

  return {
    versionCommand: versionCommand.versionCommand,
    provisionKey: provision.key,
    expirationTime: provision.expirationTime
  }
};

const updateHalHardwareInfo = async function (hardwareData, fog, transaction) {
  await Validator.validate(hardwareData, Validator.schemas.updateHardwareInfo);

  hardwareData.iofogUuid = fog.uuid;

  await HWInfoManager.updateOrCreate({
    iofogUuid: fog.uuid
  }, hardwareData, transaction);
};

const updateHalUsbInfo = async function (usbData, fog, transaction) {
  await Validator.validate(usbData, Validator.schemas.updateUsbInfo);

  usbData.iofogUuid = fog.uuid;

  await USBInfoManager.updateOrCreate({
    iofogUuid: fog.uuid
  }, usbData, transaction);
};

const deleteNode = async function (fog, transaction) {
  await FogManager.delete({
    uuid: fog.uuid
  }, transaction);
};

const getImageSnapshot = async function (fog, transaction) {
  const microservice = await MicroserviceManager.findOne({
    iofogUuid: fog.uuid,
    imageSnapshot: 'get_image'
  }, transaction);
  if (!microservice) {
    throw new Errors.NotFoundError(ErrorMessages.IMAGE_SNAPSHOT_NOT_FOUND);
  }

  return {
    uuid: microservice.uuid
  }
};

const putImageSnapshot = async function (req, fog, transaction) {
  const form = new formidable.IncomingForm();
  form.uploadDir = path.join(appRoot, '../') + 'data';
  if (!fs.existsSync(form.uploadDir)) {
    fs.mkdirSync(form.uploadDir);
  }
  const absolutePath = await saveSnapShot(req, form);
  await MicroserviceManager.update({
    iofogUuid: fog.uuid,
    imageSnapshot: 'get_image'
  }, {
    imageSnapshot: absolutePath
  }, transaction);

};

const saveSnapShot = function (req, form) {
  return new Promise((resolve, reject) => {
    form.parse(req, async function (error, fields, files) {
      if (error) {
        reject(new Errors.ValidationError());
      }

      const filePath = files['upstream']['path'];

      let absolutePath = path.resolve(filePath);
      fs.rename(absolutePath, absolutePath + '.tar.gz');
      resolve(absolutePath + '.tar.gz');
    });
  });
};

async function _checkMicroservicesFogType(fog, fogTypeId, transaction) {
  const where = {
    iofogUuid: fog.uuid
  };
  const microservices = await MicroserviceManager.findAllWithDependencies(where, {}, transaction);
  if (microservices) {

    let invalidMicroservices = [];

    for (const microservice of microservices) {
      let exists = false;
      for (const image of microservice.catalogItem.images) {
        if (image.fogTypeId === fogTypeId) {
          exists = true;
          break;
        }
      }

      if (!exists) {
        invalidMicroservices.push(microservice);
      }
    }

    if (invalidMicroservices.length > 0) {
      let errorMsg = ErrorMessages.INVALID_MICROSERVICES_FOG_TYPE;
      for (error of invalidMicroservices) {
        errorMsg = errorMsg + ' "' + error.name + '" microservice\n';
      }
      throw new Errors.ValidationError(errorMsg);
    }
  }
}

module.exports = {
  agentProvision: TransactionDecorator.generateTransaction(agentProvision),
  getAgentConfig: getAgentConfig,
  updateAgentConfig: TransactionDecorator.generateTransaction(updateAgentConfig),
  getAgentConfigChanges: TransactionDecorator.generateTransaction(getAgentConfigChanges),
  updateAgentStatus: TransactionDecorator.generateTransaction(updateAgentStatus),
  getAgentMicroservices: TransactionDecorator.generateTransaction(getAgentMicroservices),
  getAgentMicroservice: TransactionDecorator.generateTransaction(getAgentMicroservice),
  getAgentRegistries: TransactionDecorator.generateTransaction(getAgentRegistries),
  getAgentProxy: TransactionDecorator.generateTransaction(getAgentProxy),
  getAgentStrace: TransactionDecorator.generateTransaction(getAgentStrace),
  updateAgentStrace: TransactionDecorator.generateTransaction(updateAgentStrace),
  getAgentChangeVersionCommand: TransactionDecorator.generateTransaction(getAgentChangeVersionCommand),
  updateHalHardwareInfo: TransactionDecorator.generateTransaction(updateHalHardwareInfo),
  updateHalUsbInfo: TransactionDecorator.generateTransaction(updateHalUsbInfo),
  deleteNode: TransactionDecorator.generateTransaction(deleteNode),
  getImageSnapshot: TransactionDecorator.generateTransaction(getImageSnapshot),
  putImageSnapshot: TransactionDecorator.generateTransaction(putImageSnapshot)
};