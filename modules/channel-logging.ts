/*
This module provides discord logging, and is intended to log messages to a collection of logging channels.
*/
import { Module } from "../core/modules"

export let channelLogging = new Module("logging", "Manage discord channel and thread logging");

channelLogging.onInitialize = async () => {
    console.log("fuck");
}

