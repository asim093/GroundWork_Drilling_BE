import Activity from '../models/Activity.js';
import Consumable from '../models/Consumable.js';

export const listCatalogActivities = async (req, res) => {
  const activities = await Activity.find({ active: true })
    .populate('categoryId', 'name')
    .sort({ name: 1 })
    .lean();

  res.json({
    data: activities.map((activity) => ({
      id: String(activity._id),
      name: activity.name,
      category: activity.categoryId?.name || 'Uncategorised'
    }))
  });
};

export const listCatalogConsumables = async (req, res) => {
  const consumables = await Consumable.find({ active: true }).sort({ name: 1 }).lean();

  res.json({
    data: consumables.map((consumable) => ({
      id: String(consumable._id),
      name: consumable.name,
      group: consumable.group || 'Ungrouped'
    }))
  });
};
