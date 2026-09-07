import { buildListOptions, buildPaginationMeta } from '../utils/listQuery.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const SORTABLE_FIELDS = ['name', 'createdAt'];

export const makeMasterDataController = (Model, { entityName }) => {
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

    const [data, total] = await Promise.all([
      Model.find(filter).sort(sort).skip(skip).limit(limit),
      Model.countDocuments(filter)
    ]);

    res.json({ data, pagination: buildPaginationMeta(page, limit, total) });
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

    const doc = await Model.create({ name });
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

    await doc.save();
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
