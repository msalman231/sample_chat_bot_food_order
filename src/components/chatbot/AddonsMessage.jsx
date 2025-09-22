import React from 'react';

const AddonsMessage = ({ content, onItemClick }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-bold text-lg text-gray-800 mb-1">
          🍟 Addon Options
        </h3>
        <p className="text-sm text-gray-600">Enhance your meal with these extras</p>
      </div>
      
      <div className="space-y-4">
        {content.categories.map((category, categoryIndex) => (
          <div key={categoryIndex} className="bg-gray-50 rounded-lg p-3">
            <h4 className="font-semibold text-primary-600 mb-3 text-center">{category.name}</h4>
            <div className="grid gap-2">
              {category.items.map((item, itemIndex) => (
                <div key={itemIndex} className="bg-white rounded-lg p-3 border hover:border-primary-300 transition-colors cursor-pointer shadow-sm"
                     onClick={() => onItemClick(item)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                    </div>
                    <div className="ml-3 text-right">
                      <span className="text-sm font-bold text-primary-600">${item.price}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-4 pt-3 border-t">
        <p className="text-xs text-gray-500">
          💬 Say "Add [addon name]" or tap any item to add it to your order
        </p>
      </div>
    </div>
  );
};

export default AddonsMessage;