import React from 'react';import {ResourceList} from '../shared/ResourceList';
export default function MarketplaceScreen(){return <ResourceList title="Pet marketplace" subtitle="Moderated listings with welfare-first inquiries." kind="sale" path="/marketplace/pets" publicData cacheKey="marketplace" detail="SaleDetails" create="CreateSaleListing" createLabel="+ Create sale draft"/>;}
