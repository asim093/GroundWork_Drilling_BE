import { buildListOptions, buildPaginationMeta } from '../utils/listQuery.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const SORTABLE_FIELDS = ['name', 'createdAt'];

export const makeMasterDataController = (Model, { entityName, fields = [] }) => {
  const refFields = fields.filter((field) => field.kind === 'ref');
  const distinctFields = fields.filter((field) => field.distinct);
  const populatePaths = refFields.map((field) => ({ path: field.name, select: 'name active' }));

  const applyFields = async (doc, body, { isCreate }) => {
    for (const field of fields) {
      if (body[field.name] === undefined) {
        if (isCreate && field.required && !doc[field.name]) {
          return `${field.label || field.name} is required`;
        }
        continue;
      }

      if (field.kind === 'string') {
        doc[field.name] = String(body[field.name] || '').trim();
        continue;
      }

      const value = body[field.name] || null;
      if (field.required && !value) {
        return `${field.label || field.name} is required`;
      }
      if (value) {
        const exists = await field.ref.exists({ _id: value });
        if (!exists) {
          return `Selected ${(field.label || field.name).toLowerCase()} does not exist`;
        }
      }
      doc[field.name] = value;
    }

    return null;
  };

  const list = async (req, res) => {
    const { page, limit, skip, sort } = buildListOptions(req.query, {
      sortableFields: SORTABLE_FIELDS,
      defaultSort: 'name'
    });

    const filter = {};

    if (req.query.active === 'true') {
      filter.active = true;
    } else if (req.query.active === 'false') {
      filter.active = false;
    }

    if (req.query.search) {
      filter.name = { $regex: escapeRegex(String(req.query.search).trim()), $options: 'i' };
    }

    fields.forEach((field) => {
      if (field.filterParam && req.query[field.filterParam]) {
        filter[field.name] = req.query[field.filterParam];
      }
    });

    let listQuery = Model.find(filter).sort(sort).skip(skip).limit(limit);
    if (populatePaths.length) {
      listQuery = listQuery.populate(populatePaths);
    }

    const [data, total] = await Promise.all([listQuery, Model.countDocuments(filter)]);

    const response = { data, pagination: buildPaginationMeta(page, limit, total) };

    if (distinctFields.length) {
      response.distinct = {};
      for (const field of distinctFields) {
        const values = await Model.distinct(field.name);
        response.distinct[field.name] = values
          .filter((value) => value !== null && value !== undefined && value !== '')
          .sort((a, b) => String(a).localeCompare(String(b)));
      }
    }

    res.json(response);
  };

  const create = async (req, res) => {
    const name = String(req.body.name).trim();
    const existing = await Model.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
    });

    if (existing) {
      res.status(409).json({ message: `This ${entityName} already exists` });
      return;
    }

    const doc = new Model({ name });
    const fieldError = await applyFields(doc, req.body, { isCreate: true });
    if (fieldError) {
      res.status(422).json({ message: fieldError });
      return;
    }

    await doc.save();
    if (populatePaths.length) {
      await doc.populate(populatePaths);
    }

    res.status(201).json({ data: doc });
  };

  const update = async (req, res) => {
    const doc = await Model.findById(req.params.id);

    if (!doc) {
      res.status(404).json({ message: `${capitalize(entityName)} not found` });
      return;
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      const clash = await Model.findOne({
        _id: { $ne: doc._id },
        name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
      });

      if (clash) {
        res.status(409).json({ message: `This ${entityName} already exists` });
        return;
      }

      doc.name = name;
    }

    if (req.body.active !== undefined) {
      doc.active = req.body.active;
    }

    const fieldError = await applyFields(doc, req.body, { isCreate: false });
    if (fieldError) {
      res.status(422).json({ message: fieldError });
      return;
    }

    await doc.save();
    if (populatePaths.length) {
      await doc.populate(populatePaths);
    }

    res.json({ data: doc });
  };

  const remove = async (req, res) => {
    const doc = await Model.findById(req.params.id);

    if (!doc) {
      res.status(404).json({ message: `${capitalize(entityName)} not found` });
      return;
    }

    doc.active = false;
    await doc.save();
    res.json({ data: doc });
  };

  return { list, create, update, remove };
};
