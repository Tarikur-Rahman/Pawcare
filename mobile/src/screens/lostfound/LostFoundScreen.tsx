import React from 'react';import {ResourceList} from '../shared/ResourceList';
export default function LostFoundScreen(){return <ResourceList title="Lost & found" subtitle="Help pets and people find each other safely." kind="lost" path="/lost-found" publicData cacheKey="lost-found" detail="LostReportDetails" create="CreateLostReport" createLabel="+ Post a lost/found report"/>;}
