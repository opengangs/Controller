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

/**
 * @file iocatalogItemImage.js
 * @author Zishan Iqbal
 * @description This file includes a IOcatalogItemImage model used by sequalize for ORM;
 */

const Sequelize = require('sequelize');
const sequelize = require('../utils/sequelize');
const CatalogItem = require('./catalogItem');
const FogType = require('./fogType');

module.exports = function (sequelize, DataTypes) {
    const CatalogItemImage = sequelize.define('catalog_item_images', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            field: 'id'
        },
        containerImage: {
            type: DataTypes.TEXT,
            field: 'container_image'
        }
    }, {
        // don't add the timestamp attributes (updatedAt, createdAt)
        timestamps: false,
        // disable the modification of table names
        freezeTableName: true,
        // don't use camelcase for automatically added attributes but underscore style
        // so updatedAt will be updated_at
        underscored: true
    });

    CatalogItemImage.associate = function (models) {


        CatalogItemImage.belongsTo(models.CatalogItem, {
            foreignKey: 'catalog_item_id',
            as: 'catalogItemId',
            onDelete: 'cascade'
        });
        CatalogItemImage.belongsTo(models.FogType, {
            foreignKey: 'iofog_type_id',
            as: 'fogTypeId',
            onDelete: 'cascade'
        });
    };

    return CatalogItemImage;
};