// In-memory array storage for Item CRUD
// Starts empty as required by Figure 1 (Starting Phase: empty inventory table)
// Items added start with ID 1 as required by Figure 3
let items = [];
let nextId = 1;

// @desc    Get all items
// @route   GET /items or GET /api/items
export const getItems = (req, res) => {
  try {
    return res.status(200).json(items);
  } catch (error) {
    return res.status(500).json({ message: 'Error retrieving items', error: error.message });
  }
};

// @desc    Get single item by ID
// @route   GET /items/:id or GET /api/items/:id
export const getItemById = (req, res) => {
  try {
    const { id } = req.params;
    const item = items.find((item) => String(item.id) === String(id));
    if (!item) {
      return res.status(404).json({ message: `Item with ID ${id} not found` });
    }
    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Error retrieving item', error: error.message });
  }
};

// @desc    Create a new item
// @route   POST /items or POST /api/items
export const createItem = (req, res) => {
  try {
    const { name, price } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'Item name is required' });
    }

    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ message: 'Valid non-negative numeric price is required' });
    }

    const newItem = {
      id: nextId++,
      name: name.trim(),
      price: parseFloat(Number(price).toFixed(2)),
    };

    items.push(newItem);
    return res.status(201).json(newItem);
  } catch (error) {
    return res.status(500).json({ message: 'Error creating item', error: error.message });
  }
};

// @desc    Update an item by ID
// @route   PUT /items/:id or PUT /api/items/:id
export const updateItem = (req, res) => {
  try {
    const { id } = req.params;
    const { name, price } = req.body;

    const itemIndex = items.findIndex((item) => String(item.id) === String(id));

    if (itemIndex === -1) {
      return res.status(404).json({ message: `Item with ID ${id} not found` });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: 'Item name cannot be empty' });
      }
      items[itemIndex].name = name.trim();
    }

    if (price !== undefined) {
      if (isNaN(Number(price)) || Number(price) < 0) {
        return res.status(400).json({ message: 'Valid non-negative numeric price is required' });
      }
      items[itemIndex].price = parseFloat(Number(price).toFixed(2));
    }

    return res.status(200).json(items[itemIndex]);
  } catch (error) {
    return res.status(500).json({ message: 'Error updating item', error: error.message });
  }
};

// @desc    Delete an item by ID
// @route   DELETE /items/:id or DELETE /api/items/:id
export const deleteItem = (req, res) => {
  try {
    const { id } = req.params;
    const itemIndex = items.findIndex((item) => String(item.id) === String(id));

    if (itemIndex === -1) {
      return res.status(404).json({ message: `Item with ID ${id} not found` });
    }

    const deletedItem = items.splice(itemIndex, 1)[0];
    return res.status(200).json({
      message: 'Item deleted successfully',
      item: deletedItem,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting item', error: error.message });
  }
};
