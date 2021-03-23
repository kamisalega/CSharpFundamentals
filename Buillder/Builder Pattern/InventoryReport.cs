using System;
using System.Collections.Generic;
using System.Text;

namespace Builder_Pattern
{
    public class FurnitureItem
    {
        public string Name;
        public double Price;
        public double Height;
        public double Width;
        public double Weight;

        public FurnitureItem(string productName, double price, double height, double width, double weight)
        {
            this.Name = productName;
            this.Price = price;
            this.Height = height;
            this.Width = width;
            this.Weight = weight;
        }
    }

    public class InventoryReport
    {
        public string TitleSection;
        public string DimensionsSection;
        public string LogisticsSection;

        public string Debug()
        {
            return new StringBuilder()
                .AppendLine(TitleSection)
                .AppendLine(DimensionsSection)
                .AppendLine(LogisticsSection)
                .ToString();
        }
    }
}
