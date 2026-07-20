#pragma once
#include "./Types.h"

namespace ggg {
  class ListItem {
  public:
    ListItem() {}

    String name; // The name of the item
    int index; // The index of the item in the list

    ListItem(const String& name, int index) : name(name), index(index) {}

    // Virtual destructor to allow subclass destruction correctly
    virtual ~ListItem() {}
  };

  // List manages items that are subclasses of ListItem
  template<typename T>
  class List {
  private:
    std::unordered_map<String, T*> itemsByName;
    std::vector<T*> items;

  public:
    // Destructor to clean up items
    ~List() {
      for (auto item : items) {
        delete item;
      }
    }

    // Append an item to the list. T must be a subclass of ListItem.
    void append(T* item) {
      item->index = items.size(); // Set the index of the item
      items.push_back(item);
      itemsByName[item->name] = item;
    }

    // Rename an item in place, keeping the name index consistent. Mirrors
    // NamedList.setItemName in ts/ggg/NamedList.ts -- L renames a register.
    void setItemName(T* item, const String& name) {
      for (auto it = itemsByName.begin(); it != itemsByName.end(); ++it) {
        if (it->second == item) { itemsByName.erase(it); break; }
      }
      item->name = name;
      itemsByName[name] = item;
    }

    // Get an item by name
    T* getByName(const String& name) {
      if (itemsByName.find(name) != itemsByName.end()) {
        return itemsByName[name];
      }
      return nullptr; // Return null if not found
    }

    // Get an item by index
    T* getByIndex(int index) {
      if (index >= 0 && index < items.size()) {
        return items[index];
      }
      return nullptr; // Return null if out of bounds
    }
  };
}