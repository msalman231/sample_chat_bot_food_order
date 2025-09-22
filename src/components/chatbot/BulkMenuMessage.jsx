import React from 'react';

const BulkMenuMessage = ({ content, menuData, onCategoryClick, onItemClick }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
        <h3 className="font-bold text-lg text-gray-800 mb-2">
          🎯 Quantity Order: {content.requestedQuantity} {content.itemType}
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          {content.message}
        </p>
        <div className="flex items-center justify-center space-x-2 text-purple-600">
          <span className="text-xs bg-purple-100 px-3 py-1 rounded-full font-medium">
            Quantity per click: {content.requestedQuantity}
          </span>
        </div>
      </div>
      
      {/* Show menu based on category */}
      {content.category === 'all' ? (
        // Show all menu categories for general bulk orders
        <div>
          <h4 className="font-semibold text-gray-800 mb-3 text-center">Choose from all our menu items:</h4>
          <div className="grid gap-3">
            {[...new Set(menuData?.menuItems?.filter(item => !item.isAddon && item.available).map(item => item.category) || [])].map((category, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3 border hover:bg-gray-100 transition-colors cursor-pointer"
                   onClick={() => {
                     // Show category items but maintain bulk mode
                     const categoryItems = menuData?.menuItems?.filter(item => 
                       item.category === category && !item.isAddon && item.available
                     ) || [];
                     if (categoryItems.length > 0) {
                       const categoryData = {
                         categoryName: category,
                         items: categoryItems,
                         bulkMode: true,
                         quantity: content.requestedQuantity
                       };
                       // This would need to be handled by the parent component
                       // For now, we'll just call the category click handler
                       onCategoryClick(category, categoryData);
                     }
                   }}>
                <h5 className="font-semibold text-primary-600">{category}</h5>
                <p className="text-xs text-gray-500">Click to see {category.toLowerCase()} items</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Show specific category items
        <div>
          <h4 className="font-semibold text-gray-800 mb-3 text-center">{content.category} Items:</h4>
          <div className="space-y-3">
            {(menuData?.menuItems?.filter(item => 
              item.category.toLowerCase().includes(content.category.toLowerCase()) && 
              !item.isAddon && 
              item.available
            ) || []).map((item, index) => (
              <div key={index} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200 hover:shadow-md transition-all cursor-pointer"
                   onClick={() => onItemClick(item)}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-800 flex-1">{item.name}</h4>
                  <div className="text-right ml-2">
                    <span className="font-bold text-lg text-purple-600">${item.price} each</span>
                    <p className="text-xs text-purple-500">Total: ${(item.price * content.requestedQuantity).toFixed(2)}</p>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                
                {item.ingredients && item.ingredients.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.ingredients.slice(0, 3).map((ingredient, ingIndex) => (
                      <span key={ingIndex} className="text-xs bg-white text-gray-600 px-2 py-1 rounded-full border">
                        {ingredient}
                      </span>
                    ))}
                    {item.ingredients.length > 3 && (
                      <span className="text-xs text-gray-500 px-2 py-1">+{item.ingredients.length - 3} more</span>
                    )}
                  </div>
                )}
                
                <div className="mt-3 pt-2 border-t border-purple-200">
                  <p className="text-xs text-purple-600 font-medium text-center">
                    👆 Click to add {content.requestedQuantity} of this item
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="text-center mt-4 pt-3 border-t bg-purple-50 rounded-lg p-3">
        <p className="text-sm text-purple-700 font-medium mb-1">
          🎯 Quantity Order Mode Active
        </p>
        <p className="text-xs text-gray-600">
          Each item you click will be added with quantity {content.requestedQuantity}. Say "exit bulk mode" to return to normal ordering.
        </p>
      </div>
    </div>
  );
};

export default BulkMenuMessage;