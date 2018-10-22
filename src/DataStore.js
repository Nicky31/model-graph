export default function DataStore({ proto, idAttribute='id' } = {}) {
	this.idAttribute = idAttribute
	this.proto = proto
	// Containing others store dependant keys needed by model
	this.modelDependencies = {}
	// Mapping entity ids to entities
	this.entitiesMap = {}
	// Entities groups, maps groups names to entities id array
	this.groups = {all: []}

	this.clone = clone.bind(this)
	this.addToGroups = addToGroups.bind(this)
	this.getGroup = getGroup.bind(this)
	this.updateLinkField = updateLinkField.bind(this)
	this.updateEntity = updateEntity.bind(this)
	this.update = update.bind(this)
	this.replace = replace.bind(this)
	this.delete = _delete.bind(this)
	this.deleteFromGrp = deleteFromGrp.bind(this)
	this.clear = clear.bind(this)
	this.get = get.bind(this)
	this.getArray = getArray.bind(this)
	
	function clone() {
		return Object.assign({}, this, {
			entitiesMap: {...this.entitiesMap},
			groups: {...this.groups}
		})	
	}

	function addToGroups(entity, groups) {
		groups = groups.filter(cur => entity.__metas.groups.indexOf(cur) == -1)
		groups.forEach(name => {
			if (!(name in this.groups)) {
				this.groups[name] = []
			}
			this.groups[name].push(entity[this.idAttribute])
		})
		entity.__metas.groups = [...entity.__metas.groups, ...groups]
	}

	function getGroup(group) {
		return (this.groups[group] || []).map(this.get)
	}

	function updateLinkField(id, field, newId) {
		var entity = this.get(id)
		if (Array.isArray(entity[field])) {
			entity[field].push(newId)
		} else {
			entity[field] = newId
		}
		return entity
	}

	function updateEntity(entity) {
		const id = entity[this.idAttribute] + ''
		const current = this.get(id)	

		// Defining prototypes (according to model's one + metadatas)
		var proto = current && current.__proto__
		if (!proto) {
			// TODO clone before update for redux
			proto = Object.create(Object.assign({
				__metas: {
					groups: []
				}
			}, this.proto))
		} else {
			proto = Object.create(proto)
		}
		// Updating entity
		entity = Object.assign(proto, current, entity)
		this.entitiesMap[id] = entity
		return entity
	}

	function update(entities, {groups} = {}) {
		var single = false
		if (!Array.isArray(entities)) {
			single = true
			entities = [entities]
		}
		entities = entities.map(cur => {
			cur = this.updateEntity(cur)
			let entityGroups = groups
			if (!cur.__metas.groups.length) {
				entityGroups = entityGroups ? ['all', ...entityGroups] : ['all']
			}

			// Updating groups if any
			if (entityGroups && entityGroups.length) {
				this.addToGroups(cur, entityGroups)
			}			
			return cur
		})
		return single ? entities[0] : entities
	}

	function replace(oldId, newEntity, {groups} = {}) {
		var old = this.get(oldId)
		newEntity = this.updateEntity(newEntity)
		if (old) {
			old.__metas.groups.forEach(name => {
				this.groups[name] = this.groups[name].map(cur => cur === oldId ? newEntity[this.idAttribute] : cur)
			})
			newEntity.__metas.groups = old.__metas.groups
			this.delete(oldId)
		}
		return newEntity
	}

	function _delete(id) {
		var entity = this.get(id)
		if (!entity) {
			return this
		}
		entity.__metas.groups.forEach(grp => this.deleteFromGrp(id, grp))
		delete this.entitiesMap[id + '']
	}

	function deleteFromGrp(id, grp) {
		if (!this.groups[grp]) {
			return this
		}
		this.groups[grp] = this.groups[grp].filter(cur => cur !== id)
		return this
	}

	function clear() {
		this.entitiesMap = {}
		this.groups = {all: []}
		return this
	} 

	function get(id) {
		return this.entitiesMap[id + '']
	}

	function getArray(list) {
		if (!list) {
			return this.groups.all.map(this.get)
		}
		return list.map(this.get)
	}
}